/* =========================================================
   Scanify — Settings Page Script
   File: js/settings.js
   ========================================================= */

(function () {
    'use strict';

    /* ---------- Theme Handling ---------- */
    function getTheme() {
        try {
            return localStorage.getItem('scanify-theme') || 'light';
        } catch (e) {
            return 'light';
        }
    }

    function setTheme(theme) {
        console.log('[Settings] Setting theme to:', theme);

        try {
            localStorage.setItem('scanify-theme', theme);
        } catch (e) {
            console.error('localStorage error:', e);
        }

        document.documentElement.setAttribute('data-theme', theme);
        updateThemeButtons(theme);

        if (typeof window.showToast === 'function') {
            window.showToast('Theme changed to ' + theme + ' mode', 'success');
        }
    }

    function updateThemeButtons(theme) {
        const buttons = document.querySelectorAll('.theme-btn[data-theme-value]');
        buttons.forEach(function (btn) {
            const isActive = btn.dataset.themeValue === theme;
            btn.classList.toggle('active', isActive);
            btn.setAttribute('aria-pressed', String(isActive));
        });
    }

    /* ---------- Clear All Documents Modal ---------- */
    function openClearConfirm() {
        const modal = document.getElementById('clearConfirmModal');
        if (!modal) return;
        modal.hidden = false;
        document.body.style.overflow = 'hidden';
        const confirmBtn = document.getElementById('confirmClearBtn');
        if (confirmBtn) confirmBtn.focus();
    }

    function closeClearConfirm() {
        const modal = document.getElementById('clearConfirmModal');
        if (!modal) return;
        modal.hidden = true;
        document.body.style.overflow = '';
    }

    function confirmClear() {
        if (typeof window.clearAllDocuments === 'function') {
            window.clearAllDocuments();
        }
        closeClearConfirm();
        if (typeof window.showToast === 'function') {
            window.showToast('All documents have been cleared', 'success');
        }
    }

    /* ---------- Contact Form ---------- */
    function validateContactForm(form) {
        let valid = true;
        const fields = [
            { id: 'contactName',    msg: 'Please enter your name.' },
            { id: 'contactEmail',   msg: 'Please enter a valid email.', type: 'email' },
            { id: 'contactMessage', msg: 'Please enter a message.' }
        ];

        form.querySelectorAll('.form-error').forEach(function (el) {
            el.textContent = '';
        });

        fields.forEach(function (field) {
            const input = document.getElementById(field.id);
            const errorEl = form.querySelector('[data-error-for="' + field.id + '"]');
            if (!input) return;

            const value = input.value.trim();
            let fieldValid = value.length > 0;

            if (fieldValid && field.type === 'email') {
                fieldValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
            }

            if (!fieldValid) {
                valid = false;
                input.setAttribute('aria-invalid', 'true');
                if (errorEl) errorEl.textContent = field.msg;
            } else {
                input.removeAttribute('aria-invalid');
            }
        });

        return valid;
    }

    function handleContactSubmit(event) {
        event.preventDefault();
        const form = event.currentTarget;

        if (!validateContactForm(form)) {
            if (typeof window.showToast === 'function') {
                window.showToast('Please fix the errors in the form.', 'error');
            }
            return;
        }

        if (typeof window.showToast === 'function') {
            window.showToast('Thank you! Your message has been sent.', 'success');
        }
        form.reset();
    }

    /* ---------- Event Bindings ---------- */
    function bindEvents() {

        // Action buttons (data-action)
        document.addEventListener('click', function (e) {
            const trigger = e.target.closest('[data-action]');
            if (!trigger) return;

            const action = trigger.dataset.action;

            switch (action) {
                case 'go-to-scanner':
                    window.location.href = 'scanner.html';
                    break;
                case 'show-clear-confirm':
                    openClearConfirm();
                    break;
                case 'confirm-delete':
                    confirmClear();
                    break;
            }
        });

        // Close modal buttons (data-close-modal)
        document.addEventListener('click', function (e) {
            const closer = e.target.closest('[data-close-modal]');
            if (!closer) return;
            if (closer.dataset.closeModal === 'clear-confirm') {
                closeClearConfirm();
            }
        });

        // Theme buttons
        document.querySelectorAll('.theme-btn[data-theme-value]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                setTheme(btn.dataset.themeValue);
            });
        });

        // Confirm clear button
        const confirmBtn = document.getElementById('confirmClearBtn');
        if (confirmBtn) confirmBtn.addEventListener('click', confirmClear);

        // Contact form
        const contactForm = document.getElementById('contactForm');
        if (contactForm) contactForm.addEventListener('submit', handleContactSubmit);

        // ESC closes modal
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') {
                const modal = document.getElementById('clearConfirmModal');
                if (modal && !modal.hidden) closeClearConfirm();
            }
        });
    }

    /* ---------- Init ---------- */
    document.addEventListener('DOMContentLoaded', function () {
        const theme = getTheme();
        console.log('[Settings] Initial theme:', theme);
        updateThemeButtons(theme);
        bindEvents();
    });
})();