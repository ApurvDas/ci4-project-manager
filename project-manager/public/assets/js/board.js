/**
 * Kanban drag and drop.
 *
 * The card is moved in the DOM straight away so the board feels immediate, then
 * the new column and index are sent to the server. If the server refuses — a
 * viewer trying to move a card, a task that no longer exists — the board is
 * reloaded so it never shows a state the database does not agree with.
 *
 * Nothing here is a permission check. The server re-validates membership, the
 * role, the task's project and the target column on every request.
 */
(function () {
    'use strict';

    var board = document.querySelector('[data-board]');

    if (!board || board.dataset.canWrite !== '1') {
        return;
    }

    var statusLine = document.querySelector('[data-board-status]');
    // Route was generated with a 0 placeholder for the task id.
    var moveUrlTemplate = board.dataset.moveUrl;
    var csrfName = board.dataset.csrfName;
    var csrfHash = board.dataset.csrfHash;
    var dragged = null;

    function announce(message, isError) {
        if (!statusLine) {
            return;
        }

        statusLine.textContent = message;
        statusLine.classList.toggle('is-error', Boolean(isError));
    }

    function moveUrl(taskId) {
        // Replace only the final path segment, so a project id of 0 is safe.
        return moveUrlTemplate.replace(/0(\/move)?$/, taskId + '$1');
    }

    function refreshCounts() {
        board.querySelectorAll('[data-status]').forEach(function (column) {
            var count = column.querySelectorAll('.board-card').length;
            var badge = column.querySelector('[data-column-count]');

            if (badge) {
                badge.textContent = String(count);
            }
        });
    }

    /**
     * Which card should the dragged one be placed before, given the pointer
     * position? Returns null to append at the end.
     */
    function cardAfterPoint(zone, y) {
        var cards = Array.prototype.slice.call(
            zone.querySelectorAll('.board-card:not(.is-dragging)')
        );

        return cards.reduce(function (closest, card) {
            var box = card.getBoundingClientRect();
            var offset = y - box.top - box.height / 2;

            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: card };
            }

            return closest;
        }, { offset: Number.NEGATIVE_INFINITY, element: null }).element;
    }

    function persist(card, zone) {
        var taskId = card.dataset.taskId;
        var status = zone.closest('[data-status]').dataset.status;
        var position = Array.prototype.indexOf.call(
            zone.querySelectorAll('.board-card'),
            card
        );

        var body = new FormData();
        body.append('status', status);
        body.append('position', String(position));
        body.append(csrfName, csrfHash);

        fetch(moveUrl(taskId), {
            method: 'POST',
            body: body,
            headers: { 'X-Requested-With': 'XMLHttpRequest' },
            credentials: 'same-origin'
        })
            .then(function (response) {
                return response.json().then(function (data) {
                    return { ok: response.ok, data: data };
                });
            })
            .then(function (result) {
                // The token rotates on every request; keep the next drag valid.
                if (result.data && result.data.csrf) {
                    csrfName = result.data.csrf.name;
                    csrfHash = result.data.csrf.hash;
                }

                if (!result.ok) {
                    announce((result.data && result.data.message) || 'That move was refused.', true);
                    window.setTimeout(function () { window.location.reload(); }, 1200);

                    return;
                }

                announce('Saved.');
            })
            .catch(function () {
                announce('Could not reach the server. Reloading.', true);
                window.setTimeout(function () { window.location.reload(); }, 1200);
            });
    }

    board.addEventListener('dragstart', function (event) {
        var card = event.target.closest('.board-card');

        if (!card) {
            return;
        }

        dragged = card;
        card.classList.add('is-dragging');
        event.dataTransfer.effectAllowed = 'move';
        // Firefox will not start a drag without data set.
        event.dataTransfer.setData('text/plain', card.dataset.taskId);
    });

    board.addEventListener('dragend', function () {
        if (dragged) {
            dragged.classList.remove('is-dragging');
            dragged = null;
        }

        board.querySelectorAll('[data-dropzone]').forEach(function (zone) {
            zone.classList.remove('is-over');
        });
    });

    board.addEventListener('dragover', function (event) {
        var zone = event.target.closest('[data-dropzone]');

        if (!zone || !dragged) {
            return;
        }

        // Required, or the browser refuses the drop.
        event.preventDefault();
        zone.classList.add('is-over');

        var reference = cardAfterPoint(zone, event.clientY);

        if (reference === null) {
            zone.appendChild(dragged);
        } else {
            zone.insertBefore(dragged, reference);
        }
    });

    board.addEventListener('dragleave', function (event) {
        var zone = event.target.closest('[data-dropzone]');

        if (zone && !zone.contains(event.relatedTarget)) {
            zone.classList.remove('is-over');
        }
    });

    board.addEventListener('drop', function (event) {
        var zone = event.target.closest('[data-dropzone]');

        if (!zone || !dragged) {
            return;
        }

        event.preventDefault();
        zone.classList.remove('is-over');

        var card = dragged;
        refreshCounts();
        persist(card, zone);
    });
}());
