document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('sessionId');
    const userName = urlParams.get('userName');
    const isFacilitator = urlParams.get('isFacilitator') === 'true';

    if (!sessionId || !userName) {
        window.location.href = '/';
        return;
    }

    const connection = new signalR.HubConnectionBuilder()
        .withUrl('/pokerhub')
        .withAutomaticReconnect()
        .build();

    let currentVote = null;

    const setStoryBtn = document.getElementById('setStoryBtn');
    const revealVotesBtn = document.getElementById('revealVotesBtn');
    const resetVotingBtn = document.getElementById('resetVotingBtn');
    const storyTitleInput = document.getElementById('storyTitleInput');
    const storyDescriptionInput = document.getElementById('storyDescriptionInput');
    const autoRevealToggle = document.getElementById('autoRevealToggle');
    const autoRevealIndicator = document.getElementById('autoRevealIndicator');
    const hideStoryToggle = document.getElementById('hideStoryToggle');
    const storyContent = document.getElementById('storyContent');

    connection.start().then(() => {
        connection.invoke('JoinSession', sessionId, userName, isFacilitator).catch(err => {
            console.error('Error joining session:', err);
            showToast('Kon niet deelnemen aan sessie', 'error');
        });
    }).catch(err => {
        console.error('Error starting connection:', err);
        showToast('Verbinding kon niet worden gemaakt', 'error');
    });

    connection.on('ParticipantsUpdated', (participants) => {
        renderParticipants(participants);
    });

    connection.on('SessionData', (session) => {
        if (session.currentStory) {
            storyTitleInput.value = session.currentStory.title;
            storyDescriptionInput.value = session.currentStory.description;
            updateStoryDisplay(session.currentStory);
        }
        renderParticipants(session.participants);
        updateVoteStatus(session.votes, session.participants);
        if (session.isVotesRevealed && session.votes) {
            const votesWithNames = Object.entries(session.votes).map(([connectionId, vote]) => ({
                ParticipantName: session.participants.find(p => p.connectionId === vote.participantConnectionId)?.name || 'Unknown',
                Value: vote.value
            }));
            renderVotes(votesWithNames);
        }

        if (session.autoRevealVotes && autoRevealIndicator) {
            autoRevealIndicator?.classList.remove('hidden');
            autoRevealIndicator?.classList.add('flex');
        } else if (autoRevealIndicator) {
            autoRevealIndicator?.classList.add('hidden');
            autoRevealIndicator?.classList.remove('flex');
        }

        if (session.hideStoryDescription && storyContent) {
            storyContent?.classList.add('hidden');
        } else if (storyContent) {
            storyContent?.classList.remove('hidden');
        }

        if (hideStoryToggle) {
            hideStoryToggle.checked = session.hideStoryDescription;
        }
    });

    connection.on('StoryUpdated', (story) => {
        updateStoryDisplay(story);
        clearVoteSelection();
        hideCountdown();
    });

    connection.on('VotesCleared', () => {
        clearVoteSelection();
        clearVotesDisplay();
        hideCountdown();
    });

    connection.on('VoteCast', (voteCount, participantCount) => {
        updateVoteStatus({ length: voteCount }, { length: participantCount });
    });

    connection.on('VotesRevealed', (votes) => {
        console.log('VotesRevealed received:', votes);
        renderVotes(votes);
        hideCountdown();
    });

    connection.on('CountdownStarted', () => {
        startCountdown();
    });

    connection.on('VotingReset', () => {
        clearVoteSelection();
        clearVotesDisplay();
        updateVoteStatus({}, participants);
        hideCountdown();
    });

    connection.on('SetFacilitatorStatus', (isFacilitator) => {
        const storyInputs = document.getElementById('storyInputs');
        const facilitatorControls = document.getElementById('facilitatorControls');
        const hideStoryToggleContainer = document.getElementById('hideStoryToggleContainer');

        if (isFacilitator) {
            storyInputs?.classList.remove('hidden');
            facilitatorControls?.classList.remove('hidden');
            hideStoryToggleContainer?.classList.remove('hidden');
        } else {
            storyInputs?.classList.add('hidden');
            facilitatorControls?.classList.add('hidden');
            hideStoryToggleContainer?.classList.add('hidden');
        }
    });

    connection.on('StoryDescriptionToggled', (hide) => {
        if (hideStoryToggle) {
            hideStoryToggle.checked = hide;
        }

        if (hide && storyContent) {
            storyContent.classList.add('hidden');
        } else if (storyContent) {
            storyContent.classList.remove('hidden');
        }
    });

    if (autoRevealToggle) {
        autoRevealToggle.addEventListener('change', () => {
            const autoReveal = autoRevealToggle.checked;
            connection.invoke('SetAutoReveal', sessionId, autoReveal).catch(err => {
                console.error('Error setting auto-reveal:', err);
                showToast('Kon auto-onthullen niet instellen', 'error');
            });

            if (autoReveal) {
                autoRevealIndicator?.classList.remove('hidden');
                autoRevealIndicator?.classList.add('flex');
            } else {
                autoRevealIndicator?.classList.add('hidden');
                autoRevealIndicator?.classList.remove('flex');
            }
        });
    }

    if (hideStoryToggle) {
        hideStoryToggle.addEventListener('change', () => {
            const hide = hideStoryToggle.checked;
            connection.invoke('SetHideStoryDescription', sessionId, hide).catch(err => {
                console.error('Error setting hide story:', err);
                showToast('Kon story niet verbergen', 'error');
            });

            if (hide && storyContent) {
                storyContent.classList.add('hidden');
            } else if (!hide && storyContent) {
                storyContent.classList.remove('hidden');
            }
        });
    }

    setStoryBtn?.addEventListener('click', () => {
        const title = storyTitleInput.value.trim();
        const description = storyDescriptionInput.value.trim();

        if (!title) {
            showToast('Vul een story-titel in', 'warning');
            return;
        }

        connection.invoke('SetStory', sessionId, title, description).catch(err => {
            console.error('Error setting story:', err);
            showToast('Kon story niet instellen', 'error');
        });
    });

    revealVotesBtn?.addEventListener('click', () => {
        connection.invoke('RevealVotes', sessionId).catch(err => {
            console.error('Error revealing votes:', err);
            showToast('Kon stemmen niet tonen', 'error');
        });
    });

    resetVotingBtn?.addEventListener('click', () => {
        connection.invoke('ResetVoting', sessionId).catch(err => {
            console.error('Error resetting voting:', err);
            showToast('Kon stemming niet resetten', 'error');
        });
    });

    document.querySelectorAll('.poker-card').forEach(card => {
        card.addEventListener('click', () => {
            const value = card.dataset.value;
            if (currentVote === value) {
                currentVote = null;
                card.classList.remove('selected');
            } else {
                document.querySelectorAll('.poker-card').forEach(c => c.classList.remove('selected'));
                currentVote = value;
                card.classList.add('selected');
            }

            connection.invoke('CastVote', sessionId, currentVote || '').catch(err => {
                console.error('Error casting vote:', err);
                showToast('Kon stem niet uitbrengen', 'error');
            });
        });
    });

    function renderParticipants(participants) {
        const container = document.getElementById('participantsContainer');
        if (!container) return;

        container.innerHTML = participants.map(p => `
            <div class="avatar" style="background: ${getRandomColor()}" title="${p.name}">
                ${getInitials(p.name)}
                ${p.isFacilitator ? '<span class="text-xs absolute -top-1 -right-1 bg-yellow-400 text-yellow-900 rounded-full w-4 h-4 flex items-center justify-center">★</span>' : ''}
            </div>
        `).join('');

        const participantCountEl = document.getElementById('participantCount');
        if (participantCountEl) {
            participantCountEl.textContent = participants.length;
        }

        window.participants = participants;
    }

    function updateStoryDisplay(story) {
        const titleEl = document.getElementById('currentStoryTitle');
        const descriptionEl = document.getElementById('currentStoryDescription');

        if (titleEl) titleEl.textContent = story.title || 'Geen story';
        if (descriptionEl) descriptionEl.textContent = story.description || '';
    }

    function updateVoteStatus(votes, participants) {
        const voteCountEl = document.getElementById('voteCount');
        const totalParticipantsEl = document.getElementById('totalParticipants');
        const progressBar = document.getElementById('votingProgress');

        const voteCount = votes?.length || 0;
        const total = participants?.length || 0;

        if (voteCountEl) voteCountEl.textContent = voteCount;
        if (totalParticipantsEl) totalParticipantsEl.textContent = total;
        if (progressBar) {
            const percentage = total > 0 ? (voteCount / total) * 100 : 0;
            progressBar.style.width = `${percentage}%`;
        }
    }

    function renderVotes(votes) {
        const container = document.getElementById('votesContainer');
        if (!container) return;

        if (!votes || votes.length === 0) {
            container.innerHTML = `
                <div class="text-white/60 text-center py-8 col-span-2">
                    Nog geen stemmen
                </div>
            `;
            return;
        }

        container.innerHTML = votes.map((vote, index) => `
            <div class="vote-reveal bg-white rounded-xl p-6 shadow-lg text-center border border-slate-100" style="animation-delay: ${index * 0.1}s">
                <div class="text-sm font-medium text-slate-500 mb-2">${vote.participantName}</div>
                <div class="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">${vote.value}</div>
            </div>
        `).join('');
    }

    function clearVoteSelection() {
        document.querySelectorAll('.poker-card').forEach(card => card.classList.remove('selected'));
        currentVote = null;
    }

    function clearVotesDisplay() {
        const container = document.getElementById('votesContainer');
        if (container) container.innerHTML = '';
    }

    let countdownTimer = null;
    let countdownValue = 3;

    function startCountdown() {
        console.log('Countdown started');
        const container = document.getElementById('countdownContainer');
        const numberEl = document.getElementById('countdownNumber');
        const progressEl = document.getElementById('countdownProgress');
        if (!container || !numberEl || !progressEl) return;

        countdownValue = 3;
        container.classList.remove('hidden');
        numberEl.textContent = countdownValue;
        progressEl.style.width = '100%';

        if (countdownTimer) {
            clearInterval(countdownTimer);
        }

        countdownTimer = setInterval(() => {
            countdownValue--;
            if (countdownValue > 0) {
                numberEl.textContent = countdownValue;
                const percentage = (countdownValue / 3) * 100;
                progressEl.style.width = `${percentage}%`;
            } else {
                console.log('Countdown finished, hiding');
                hideCountdown();
            }
        }, 1000);
    }

    function hideCountdown() {
        const container = document.getElementById('countdownContainer');
        if (container) {
            container.classList.add('hidden');
        }
        if (countdownTimer) {
            clearInterval(countdownTimer);
            countdownTimer = null;
        }
    }
});