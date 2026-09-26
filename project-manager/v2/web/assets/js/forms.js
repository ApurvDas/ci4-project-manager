/**
 * Shared form behaviour: password visibility, inline validation and a submit
 * loading state. Applies to any form marked with `data-validated`.
 *
 * This is a convenience layer only. Every rule enforced here is also enforced
 * server-side by Postgres constraints and RPC checks — nothing may rely on
 * these checks.
 */
(function () {
    'use strict';

    /**
     * Rules are keyed by the data-validate attribute on each field wrapper.
     * Each returns an error message, or null when the value is acceptable.
     */
    var rules = {
        email: function (value) {
            if (value === '') {
                return 'Enter your email address.';
            }

            // Deliberately loose: the server does the authoritative check.
            return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
                ? null
                : 'Enter a valid email address, for example name@example.com.';
        },

        username: function (value) {
            if (value === '') {
                return 'Choose a username.';
            }

            if (value.length < 3) {
                return 'Usernames must be at least 3 characters long.';
            }

            return /^[a-zA-Z0-9._-]+$/.test(value)
                ? null
                : 'Use only letters, numbers, dots, underscores and hyphens.';
        },

        /**
         * Sign-in only: check that something was typed, but never impose a
         * length rule on an existing password.
         */
        passwordRequired: function (value) {
            return value === '' ? 'Enter your password.' : null;
        },

        /** Used when choosing a new password. */
        password: function (value) {
            if (value === '') {
                return 'Enter your password.';
            }

            return value.length < 8
                ? 'Passwords must be at least 8 characters long.'
                : null;
        },

        passwordConfirm: function (value, form) {
            var password = form.querySelector('input[name="password"]');

            if (value === '') {
                return 'Repeat your password.';
            }

            return password && password.value !== value
                ? 'The two passwords do not match.'
                : null;
        },

        projectName: function (value) {
            if (value === '') {
                return 'Give the project a name.';
            }

            return value.length < 3
                ? 'Project names must be at least 3 characters long.'
                : null;
        },

        token: function (value) {
            return /^\d{6}$/.test(value)
                ? null
                : 'Enter the six digit code from the email.';
        }
    };

    function fieldOf(input) {
        return input.closest('.field');
    }

    function showError(input, message) {
        var field = fieldOf(input);

        if (!field) {
            return;
        }

        var slot = field.querySelector('.field-error');

        if (slot) {
            slot.textContent = message;
        }

        field.classList.add('is-invalid');
        input.setAttribute('aria-invalid', 'true');
    }

    function clearError(input) {
        var field = fieldOf(input);

        if (!field) {
            return;
        }

        field.classList.remove('is-invalid');
        input.removeAttribute('aria-invalid');
    }

    /**
     * @return {boolean} whether the field passed.
     */
    function validate(input, form) {
        var field = fieldOf(input);
        var rule = field && field.dataset.validate;

        if (!rule || !rules[rule]) {
            return true;
        }

        var message = rules[rule](input.value.trim(), form);

        if (message === null) {
            clearError(input);

            return true;
        }

        showError(input, message);

        return false;
    }

    function enhance(form) {
        var inputs = Array.prototype.slice.call(
            form.querySelectorAll('.field[data-validate] input')
        );

        inputs.forEach(function (input) {
            // Validate on blur, but only clear errors while typing, so the user
            // is not scolded mid-word.
            input.addEventListener('blur', function () {
                validate(input, form);
            });

            input.addEventListener('input', function () {
                if (fieldOf(input).classList.contains('is-invalid')) {
                    validate(input, form);
                }
            });
        });

        form.addEventListener('submit', function (event) {
            var firstInvalid = null;

            inputs.forEach(function (input) {
                if (!validate(input, form) && firstInvalid === null) {
                    firstInvalid = input;
                }
            });

            if (firstInvalid !== null) {
                event.preventDefault();
                firstInvalid.focus();

                return;
            }

            var submit = form.querySelector('button[type="submit"]');

            if (submit) {
                // Guard against a double submission while the request is in
                // flight. The button keeps its width so the layout is stable.
                submit.setAttribute('aria-busy', 'true');
                submit.disabled = true;
                submit.dataset.idleLabel = submit.textContent;
                submit.textContent = submit.dataset.busyLabel || 'Please wait…';
            }
        });
    }

    function enablePasswordToggles(root) {
        root.querySelectorAll('.password-toggle').forEach(function (button) {
            button.addEventListener('click', function () {
                var input = document.getElementById(button.dataset.target);

                if (!input) {
                    return;
                }

                var revealed = input.type === 'text';

                input.type = revealed ? 'password' : 'text';
                button.textContent = revealed ? 'Show' : 'Hide';
                button.setAttribute('aria-pressed', String(!revealed));
            });
        });
    }

    // Pages render their forms after load, so they call this once rendered.
    // reset() undoes the busy state when a submit fails without navigating.
    window.pmForms = {
        enhance: function (root) {
            root.querySelectorAll('form[data-validated]').forEach(enhance);
            enablePasswordToggles(root);
        },
        reset: function (form) {
            var submit = form.querySelector('button[type="submit"]');

            if (submit && submit.dataset.idleLabel) {
                submit.removeAttribute('aria-busy');
                submit.disabled = false;
                submit.textContent = submit.dataset.idleLabel;
            }
        },
    };
}());
