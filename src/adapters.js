// LocalApply ATS Adapters & Universal DOM Scanner
// Supports Workday, Greenhouse, Ashby, Eightfold, Lever, SmartRecruiters, iCIMS, and Universal Forms

(function (global) {
  const WORKDAY_AUTOMATION_MAP = {
    legalNameSection_firstName: 'First Name',
    legalNameSection_middleName: 'Middle Name',
    legalNameSection_lastName: 'Last Name',
    preferredNameSection_firstName: 'Preferred Name',
    addressSection_addressLine1: 'Address Line 1',
    addressSection_addressLine2: 'Address Line 2',
    addressSection_city: 'City',
    addressSection_countryRegion: 'State / Province',
    addressSection_postalCode: 'Postal Code',
    country: 'Country',
    'phone-device-type': 'Phone Device Type',
    'phone-number': 'Phone Number',
    email: 'Email Address',
    jobTitle: 'Job Title',
    company: 'Company Name',
    location: 'Location',
    roleDescription: 'Role Description',
    currentlyWorkHere: 'Currently Work Here',
    school: 'School or University',
    degree: 'Degree',
    fieldOfStudy: 'Field of Study',
    gpa: 'GPA',
    sourcePrompt: 'How did you hear about us',
    veteranStatus: 'Veteran Status',
    ethnicityDropdown: 'Race / Ethnicity',
    genderDropdown: 'Gender',
    disabilityStatus: 'Disability Status'
  };

  function detectPlatform(doc = document, loc = window.location) {
    const host = (loc.hostname || '').toLowerCase();
    const href = (loc.href || '').toLowerCase();

    if (
      host.includes('myworkdayjobs.com') ||
      host.includes('myworkdaysite.com') ||
      host.includes('workday.com') ||
      doc.querySelector('[data-automation-id="applyFlowPage"], [data-automation-id="legalNameSection_firstName"]')
    ) {
      return { id: 'workday', name: 'Workday', badgeColor: '#0ea5e9' };
    }
    if (
      host.includes('greenhouse.io') ||
      href.includes('gh_jid=') ||
      doc.querySelector('#grnhse_app, #application_form[action*="greenhouse"]')
    ) {
      return { id: 'greenhouse', name: 'Greenhouse', badgeColor: '#10b981' };
    }
    if (
      host.includes('ashbyhq.com') ||
      doc.querySelector('[class*="ashby-application"], [_systemfield_]')
    ) {
      return { id: 'ashby', name: 'Ashby', badgeColor: '#6366f1' };
    }
    if (
      host.includes('eightfold.ai') ||
      doc.querySelector('[class*="ef-application"], [data-test-id*="eightfold"], [data-ef-id]')
    ) {
      return { id: 'eightfold', name: 'Eightfold.ai', badgeColor: '#8b5cf6' };
    }
    if (
      host.includes('lever.co') ||
      doc.querySelector('.application-question, form[action*="lever.co"]')
    ) {
      return { id: 'lever', name: 'Lever', badgeColor: '#f59e0b' };
    }
    if (host.includes('smartrecruiters.com')) {
      return { id: 'smartrecruiters', name: 'SmartRecruiters', badgeColor: '#14b8a6' };
    }
    if (host.includes('icims.com')) {
      return { id: 'icims', name: 'iCIMS', badgeColor: '#ec4899' };
    }

    // Check if page has sandbox test switcher attribute
    const sandboxAttr = doc.body && doc.body.getAttribute('data-ats-platform');
    if (sandboxAttr) {
      return { id: sandboxAttr.toLowerCase(), name: sandboxAttr, badgeColor: '#10b981' };
    }

    return { id: 'universal', name: 'Universal ATS', badgeColor: '#64748b' };
  }

  function isLikelyJobApplicationPage(doc = document, loc = window.location) {
    const platform = detectPlatform(doc, loc);
    if (platform.id !== 'universal') return true;

    const urlStr = (loc.href || '').toLowerCase();
    if (/apply|application|careers|jobs|talent|candidate|recruiting/i.test(urlStr)) {
      return true;
    }

    const forms = doc.querySelectorAll('form, [role="form"]');
    if (forms.length > 0) {
      const pageText = (doc.body ? doc.body.innerText : '').slice(0, 5000);
      if (/resume|cover letter|work experience|work authorization|sponsorship|linkedin/i.test(pageText)) {
        return true;
      }
    }
    return false;
  }

  function isElementVisible(el) {
    if (!el) return false;
    // File inputs are frequently visually hidden behind custom "Upload Resume" dropzones
    if (el.tagName === 'INPUT' && el.type === 'file') return true;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      return false;
    }
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function collectAllElements(root = document, visited = new Set()) {
    const results = [];
    const walker = (node) => {
      if (!node || visited.has(node)) return;
      visited.add(node);

      const children = node.querySelectorAll
        ? node.querySelectorAll(
            'input, textarea, select, button[aria-haspopup="listbox"], [role="combobox"], [data-ashby-yesno], [data-custom-select]'
          )
        : [];

      for (const el of children) {
        // Ignore our own floating widget elements
        if (el.closest('#localapply-host-root, .localapply-ignore')) continue;
        results.push(el);
      }

      // Traverse open Shadow DOM roots (used by Eightfold & web components)
      const allNodes = node.querySelectorAll ? node.querySelectorAll('*') : [];
      for (const n of allNodes) {
        if (n.id === 'localapply-host-root') continue;
        if (n.shadowRoot) {
          walker(n.shadowRoot);
        }
      }
    };

    walker(root);
    return results;
  }

  function cleanLabelText(raw) {
    if (!raw) return '';
    return raw
      .replace(/\*+/g, '')
      .replace(/\(required\)/gi, '')
      .replace(/\(optional\)/gi, '')
      .replace(/\brequired\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function detectSectionAndIndex(el) {
    // Check if inside a repeating Work Experience or Education container
    const expContainer = el.closest(
      '[data-automation-id*="workExperience"], [data-section="experience"], .work-experience-item, .experience-entry, [class*="work-experience"]'
    );
    if (expContainer) {
      const parent = expContainer.parentElement;
      if (parent) {
        const siblings = Array.from(
          parent.querySelectorAll(
            '[data-automation-id*="workExperience"], [data-section="experience"], .work-experience-item, .experience-entry'
          )
        );
        const idx = siblings.indexOf(expContainer);
        return { sectionContext: 'experience', indexContext: idx >= 0 ? idx : 0 };
      }
      return { sectionContext: 'experience', indexContext: 0 };
    }

    const eduContainer = el.closest(
      '[data-automation-id*="education"], [data-section="education"], .education-item, .education-entry, [class*="education-section"]'
    );
    if (eduContainer) {
      const parent = eduContainer.parentElement;
      if (parent) {
        const siblings = Array.from(
          parent.querySelectorAll(
            '[data-automation-id*="education"], [data-section="education"], .education-item, .education-entry'
          )
        );
        const idx = siblings.indexOf(eduContainer);
        return { sectionContext: 'education', indexContext: idx >= 0 ? idx : 0 };
      }
      return { sectionContext: 'education', indexContext: 0 };
    }

    return { sectionContext: null, indexContext: 0 };
  }

  function extractQuestionLabel(el) {
    const doc = el.ownerDocument || document;

    // 1. Check explicit data-question-label or Workday data-automation-id
    const explicitLabel = el.getAttribute('data-question-label');
    if (explicitLabel) return cleanLabelText(explicitLabel);

    const autoId =
      el.getAttribute('data-automation-id') ||
      (el.closest('[data-automation-id]') && el.closest('[data-automation-id]').getAttribute('data-automation-id')) ||
      '';

    if (autoId && WORKDAY_AUTOMATION_MAP[autoId]) {
      return WORKDAY_AUTOMATION_MAP[autoId];
    }

    // 2. aria-labelledby
    const labelledBy = el.getAttribute('aria-labelledby');
    if (labelledBy) {
      const labelText = labelledBy
        .split(/\s+/)
        .map((id) => {
          const node = doc.getElementById(id);
          return node ? node.textContent : '';
        })
        .join(' ');
      if (cleanLabelText(labelText)) return cleanLabelText(labelText);
    }

    // 3. Explicit <label for="id">
    if (el.id) {
      try {
        const labelNode = doc.querySelector(`label[for="${CSS.escape(el.id)}"]`);
        if (labelNode) {
          const clone = labelNode.cloneNode(true);
          clone.querySelectorAll('input, select, textarea, .select__container').forEach((n) => n.remove());
          const text = cleanLabelText(clone.textContent);
          if (text) return text;
        }
      } catch (e) {
        // ignore invalid selector
      }
    }

    // 4. Wrapping <label> or fieldset <legend>
    const parentLabel = el.closest('label');
    if (parentLabel) {
      const clone = parentLabel.cloneNode(true);
      clone.querySelectorAll('input, select, textarea').forEach((n) => n.remove());
      const text = cleanLabelText(clone.textContent);
      if (text) return text;
    }

    // 5. Enclosing question container (.field, .application-question, .form-group, etc.)
    const container = el.closest(
      '.application-question, .field, .form-group, .form-field, [data-automation-id*="formField"], .ashby-application-form-field-entry, .ef-field, fieldset'
    );
    if (container) {
      const heading = container.querySelector(
        'label, legend, .application-label, .field-label, .question-title, [data-automation-id="formLabel"]'
      );
      if (heading && !heading.contains(el)) {
        const text = cleanLabelText(heading.textContent);
        if (text) return text;
      }
    }

    // 6. aria-label or placeholder
    const ariaLabel = cleanLabelText(el.getAttribute('aria-label'));
    if (ariaLabel) return ariaLabel;

    const placeholder = cleanLabelText(el.getAttribute('placeholder'));
    if (placeholder && placeholder.length < 70 && !/^select|^enter\s+text|^type\s+here/i.test(placeholder)) {
      return placeholder;
    }

    // 7. Fallback to humanized name or id
    const rawAttr = autoId || el.name || el.id || '';
    return cleanLabelText(
      rawAttr
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/[_-]+/g, ' ')
    );
  }

  function scanPageFields(doc = document) {
    const rawElements = collectAllElements(doc);
    const scannedFields = [];
    const processedRadioGroups = new Set();

    for (const el of rawElements) {
      const tag = (el.tagName || '').toLowerCase();
      const type = (el.type || '').toLowerCase();

      // Skip hidden/submit/button/reset/search inputs
      if (tag === 'input' && ['hidden', 'submit', 'button', 'reset', 'image', 'password'].includes(type)) {
        continue;
      }
      if (el.disabled || el.readOnly) continue;
      if (!isElementVisible(el)) continue;

      // Group radio inputs by name or container so a Yes/No radio pair is treated as 1 logical question
      if (tag === 'input' && type === 'radio') {
        const groupKey = el.name || el.closest('fieldset, .radio-group, .application-question')?.id || '';
        if (groupKey && processedRadioGroups.has(groupKey)) {
          continue;
        }
        if (groupKey) processedRadioGroups.add(groupKey);

        const groupContainer =
          el.closest('fieldset, .radio-group, .application-question, .form-group, .ashby-application-form-field-entry') ||
          el.parentElement;
        const radios = groupKey
          ? Array.from(doc.querySelectorAll(`input[type="radio"][name="${CSS.escape(groupKey)}"]`))
          : Array.from(groupContainer.querySelectorAll('input[type="radio"]'));

        let groupLabel = '';
        if (groupContainer) {
          const legendOrLabel = groupContainer.querySelector('legend, .question-title, .field-label, label:first-child');
          if (legendOrLabel && !legendOrLabel.querySelector('input')) {
            groupLabel = cleanLabelText(legendOrLabel.textContent);
          }
        }
        if (!groupLabel) groupLabel = extractQuestionLabel(el);

        const { sectionContext, indexContext } = detectSectionAndIndex(el);
        scannedFields.push({
          fieldId: 'field_radio_' + scannedFields.length,
          element: el,
          radioElements: radios,
          controlType: 'radio-group',
          descriptor: {
            label: groupLabel,
            name: el.name || '',
            id: el.id || '',
            placeholder: '',
            ariaLabel: el.getAttribute('aria-label') || '',
            automationId: el.getAttribute('data-automation-id') || '',
            tagName: 'input',
            inputType: 'radio',
            sectionContext,
            indexContext
          }
        });
        continue;
      }

      // Custom listbox button (Workday / Ashby / Custom Select)
      const isListboxBtn =
        (tag === 'button' && el.getAttribute('aria-haspopup') === 'listbox') ||
        el.hasAttribute('data-custom-select');

      const controlType = isListboxBtn
        ? 'custom-listbox'
        : tag === 'select'
        ? 'select'
        : type === 'checkbox'
        ? 'checkbox'
        : type === 'file'
        ? 'file'
        : tag === 'textarea'
        ? 'textarea'
        : 'text';

      const label = extractQuestionLabel(el);
      const { sectionContext, indexContext } = detectSectionAndIndex(el);

      scannedFields.push({
        fieldId: 'field_' + scannedFields.length,
        element: el,
        controlType,
        descriptor: {
          label,
          name: el.name || '',
          id: el.id || '',
          placeholder: el.getAttribute('placeholder') || '',
          ariaLabel: el.getAttribute('aria-label') || '',
          automationId:
            el.getAttribute('data-automation-id') ||
            el.getAttribute('_systemfield_') ||
            el.getAttribute('data-ef-id') ||
            '',
          tagName: tag,
          inputType: type || tag,
          sectionContext,
          indexContext
        }
      });
    }

    return scannedFields;
  }

  function setNativeValue(el, value) {
    const valueSetter = Object.getOwnPropertyDescriptor(el, 'value')?.set;
    const prototype = Object.getPrototypeOf(el);
    const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;

    if (valueSetter && valueSetter !== prototypeValueSetter) {
      prototypeValueSetter.call(el, value);
    } else if (prototypeValueSetter) {
      prototypeValueSetter.call(el, value);
    } else {
      el.value = value;
    }

    el.dispatchEvent(new Event('focus', { bubbles: true }));
    el.dispatchEvent(new InputEvent('input', { bubbles: true, data: String(value), inputType: 'insertText' }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  function readCurrentFieldValue(scannedField) {
    const el = scannedField.element;
    if (!el) return '';

    if (scannedField.controlType === 'radio-group' && scannedField.radioElements) {
      for (const r of scannedField.radioElements) {
        if (r.checked) {
          const lbl =
            (r.id && document.querySelector(`label[for="${CSS.escape(r.id)}"]`)?.textContent) ||
            r.closest('label')?.textContent ||
            r.value;
          return cleanLabelText(lbl || r.value);
        }
      }
      return '';
    }

    if (scannedField.controlType === 'checkbox') {
      return el.checked ? 'Yes' : '';
    }

    if (scannedField.controlType === 'select') {
      const selectedOpt = el.options && el.options[el.selectedIndex];
      if (!selectedOpt || !selectedOpt.value || /^select|^choose|^--/i.test(selectedOpt.text.trim())) {
        return '';
      }
      return selectedOpt.text.trim();
    }

    if (scannedField.controlType === 'custom-listbox') {
      const txt = cleanLabelText(el.getAttribute('data-selected-value') || el.textContent || '');
      if (/^select|^choose|^--/i.test(txt)) return '';
      return txt;
    }

    if (scannedField.controlType === 'file') {
      return el.files && el.files[0] ? el.files[0].name : '';
    }

    return (el.value || '').trim();
  }

  async function fillSingleField(scannedField, matchResult, options = {}) {
    const el = scannedField.element;
    if (!el || !matchResult || !matchResult.matched) return false;

    const desiredValue = matchResult.value;
    const overwrite = Boolean(options.overwriteExistingValues);
    const highlight = options.highlightFilledFields !== false;

    // Skip if already filled and overwrite is false
    const existingVal = readCurrentFieldValue(scannedField);
    if (existingVal && !overwrite && scannedField.controlType !== 'file') {
      return false;
    }

    let filled = false;

    try {
      if (scannedField.controlType === 'file') {
        const fileObj = matchResult.fileObject;
        if (fileObj && global.LocalApplyStorage) {
          const reconstructedFile = global.LocalApplyStorage.dataUrlToFile(fileObj);
          if (reconstructedFile) {
            const dt = new DataTransfer();
            dt.items.add(reconstructedFile);
            el.files = dt.files;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            // Update any adjacent filename badge if present
            const dropzone = el.closest('.file-upload-zone, .dropzone, .field, label');
            if (dropzone) {
              const statusEl = dropzone.querySelector('.file-name, .upload-status, [data-file-status]');
              if (statusEl) {
                statusEl.textContent = `Attached: ${reconstructedFile.name}`;
              }
            }
            filled = true;
          }
        }
      } else if (scannedField.controlType === 'select') {
        const opts = Array.from(el.options).map((o, idx) => ({
          index: idx,
          value: o.value,
          text: o.text,
          element: o
        }));
        const bestOpt = global.LocalApplyMatcher.findBestOptionMatch(desiredValue, opts);
        if (bestOpt) {
          el.selectedIndex = bestOpt.index;
          el.value = bestOpt.value;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          filled = true;
        }
      } else if (scannedField.controlType === 'radio-group' && scannedField.radioElements) {
        const radioOpts = scannedField.radioElements.map((r) => {
          const lbl =
            (r.id && document.querySelector(`label[for="${CSS.escape(r.id)}"]`)?.textContent) ||
            r.closest('label')?.textContent ||
            r.value;
          return {
            value: r.value,
            text: cleanLabelText(lbl || r.value),
            element: r
          };
        });
        const bestRadio = global.LocalApplyMatcher.findBestOptionMatch(desiredValue, radioOpts);
        if (bestRadio && bestRadio.element) {
          bestRadio.element.click();
          bestRadio.element.checked = true;
          bestRadio.element.dispatchEvent(new Event('change', { bubbles: true }));
          filled = true;
        }
      } else if (scannedField.controlType === 'checkbox') {
        const shouldCheck = ['yes', 'true', '1', 'checked'].includes(String(desiredValue).toLowerCase());
        if (el.checked !== shouldCheck) {
          el.click();
          el.checked = shouldCheck;
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }
        filled = true;
      } else if (scannedField.controlType === 'custom-listbox') {
        // Handle Workday / Ashby / Custom listbox dropdowns
        el.click();
        await new Promise((r) => setTimeout(r, 80));
        const listboxId = el.getAttribute('aria-controls') || el.getAttribute('aria-owns');
        const listbox =
          (listboxId && document.getElementById(listboxId)) ||
          document.querySelector('[role="listbox"]:not([hidden])');
        if (listbox) {
          const optionEls = Array.from(listbox.querySelectorAll('[role="option"], li'));
          const optItems = optionEls.map((o) => ({
            text: cleanLabelText(o.textContent),
            value: o.getAttribute('data-value') || cleanLabelText(o.textContent),
            element: o
          }));
          const best = global.LocalApplyMatcher.findBestOptionMatch(desiredValue, optItems);
          if (best && best.element) {
            best.element.click();
            el.setAttribute('data-selected-value', best.text);
            filled = true;
          }
        }
      } else {
        // Standard text, email, tel, url, number, date, textarea
        setNativeValue(el, desiredValue);
        filled = true;
      }

      if (filled && highlight) {
        const targetVisual =
          scannedField.controlType === 'radio-group'
            ? el.closest('fieldset, .radio-group, .form-group') || el.parentElement
            : scannedField.controlType === 'file'
            ? el.closest('.file-upload-zone, .dropzone, label') || el.parentElement
            : el;

        if (targetVisual && targetVisual.style) {
          targetVisual.style.transition = 'box-shadow 0.25s ease, border-color 0.25s ease';
          targetVisual.style.boxShadow = '0 0 0 2px rgba(16, 185, 129, 0.45)';
          targetVisual.style.borderColor = '#10b981';
        }
      }
    } catch (err) {
      console.warn('[LocalApply] Error filling field:', scannedField.descriptor.label, err);
    }

    return filled;
  }

  global.LocalApplyAdapters = {
    detectPlatform,
    isLikelyJobApplicationPage,
    scanPageFields,
    readCurrentFieldValue,
    fillSingleField,
    cleanLabelText
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
