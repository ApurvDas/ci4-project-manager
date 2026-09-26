/**
 * Kanban drag and drop.
 *
 * The card is moved in the DOM straight away so the board feels immediate, then
 * the new column and index are sent to the server. If the server refuses — a
 * viewer trying to move a card, a task that no longer exists — the board is
 * reloaded so it never shows a state the database does not agree with.
 *
 * Nothing here is a permission check. move_task() re-validates membership, the
 * role, the task's project and the target column on every request.
 *
 * move(taskId, status, position) persists the drop and rejects on refusal.
 */
export function enableBoard(board, move) {
    if (!board || board.dataset.canWrite !== '1') {
        return;
    }

    var statusLine = document.querySelector('[data-board-status]');
    var dragged = null;

    function announce(message, isError) {
        if (!statusLine) {
            return;
        }

        statusLine.textContent = message;
        statusLine.classList.toggle('is-error', Boolean(isError));
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

        move(taskId, status, position)
            .then(function () {
                announce('Saved.');
            })
            .catch(function (error) {
                announce((error && error.message) || 'That move was refused.', true);
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
}
