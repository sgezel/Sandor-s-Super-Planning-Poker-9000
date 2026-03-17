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
    let currentRoundNumber = 1;
    let countdownActive = false;
    let currentStory = null;
    let isFacilitatorState = isFacilitator;
    let currentVotes = {};
    let motivateTimer = null;

    function cardValueToNumber(value) {
        if (value === '½') return 0.5;
        const num = parseFloat(value);
        return isNaN(num) ? null : num;
    }

    updateStoryDisplay(currentStory);

    const setStoryBtn = document.getElementById('setStoryBtn');
    const revealVotesBtn = document.getElementById('revealVotesBtn');
    const resetVotingBtn = document.getElementById('resetVotingBtn');
    const storyTitleInput = document.getElementById('storyTitleInput');
    const storyDescriptionInput = document.getElementById('storyDescriptionInput');
    const autoRevealToggle = document.getElementById('autoRevealToggle');
    const autoRevealIndicator = document.getElementById('autoRevealIndicator');
    const autoStartNewRoundToggle = document.getElementById('autoStartNewRoundToggle');
    const autoStartIndicator = document.getElementById('autoStartIndicator');
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
        updateVoteStatus(currentVotes, participants);
    });

    connection.on('SessionData', (session) => {
        currentRoundNumber = session.roundNumber || 1;
        currentStory = session.currentStory || null;
        currentVotes = session.votes || {};

        if (session.currentStory) {
            storyTitleInput.value = session.currentStory.title;
            storyDescriptionInput.value = session.currentStory.description;
        }
        updateStoryDisplay(currentStory);
        renderParticipants(session.participants);
        updateVoteStatus(currentVotes, session.participants);
        if (session.isVotesRevealed && session.votes) {
            const votesWithNames = Object.entries(session.votes).map(([connectionId, vote]) => ({
                ParticipantName: session.participants.find(p => p.connectionId === vote.participantConnectionId)?.name || 'Unknown',
                Value: vote.value
            }));
            renderVotes(votesWithNames);
            if (shouldCelebrate(votesWithNames)) {
                launchConfetti();
            }
        }

        renderRoundHistory(session.previousRounds);
        renderStatistics(session.previousRounds);

        if (session.autoRevealVotes && autoRevealIndicator) {
            autoRevealIndicator?.classList.remove('hidden');
            autoRevealIndicator?.classList.add('flex');
        } else if (autoRevealIndicator) {
            autoRevealIndicator?.classList.add('hidden');
            autoRevealIndicator?.classList.remove('flex');
        }

        if (autoStartNewRoundToggle) {
            autoStartNewRoundToggle.checked = session.autoStartNewRound;
        }

        if (session.autoStartNewRound && autoStartIndicator) {
            autoStartIndicator?.classList.remove('hidden');
            autoStartIndicator?.classList.add('flex');
        } else if (autoStartIndicator) {
            autoStartIndicator?.classList.add('hidden');
            autoStartIndicator?.classList.remove('flex');
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
        currentStory = story;
        updateStoryDisplay(story);
        clearVoteSelection();
        hideCountdown();
    });

    connection.on('VotesCleared', () => {
        currentVotes = {};
        clearVoteSelection();
        clearVotesDisplay();
        updateVoteStatus(currentVotes, window.participants || []);
        hideCountdown();
    });

    connection.on('VoteCast', (votedConnectionIds) => {
        currentVotes = (votedConnectionIds || []).reduce((votesByParticipant, connectionId) => {
            votesByParticipant[connectionId] = true;
            return votesByParticipant;
        }, {});

        updateVoteStatus(currentVotes, window.participants || []);
        resetMotivateTimer();
    });

    connection.on('VotesRevealed', (votes) => {
        console.log('VotesRevealed received:', votes);
        renderVotes(votes);
        if (shouldCelebrate(votes)) {
            launchConfetti();
        }
        hideCountdown();
        clearMotivateTimer();
    });

    connection.on('CountdownStarted', () => {
        startCountdown();
    });

    connection.on('VotingReset', () => {
        currentVotes = {};
        clearVoteSelection();
        clearVotesDisplay();
        updateVoteStatus(currentVotes, window.participants || []);
        hideCountdown();
        updateStoryDisplay(currentStory);
        clearMotivateTimer();
    });

    connection.on('MotivationPlayed', (audioFile) => {
        new Audio('/audio/' + audioFile).play().catch(() => {});
        hideMotivateBtn();
        resetMotivateTimer();
    });

    connection.on('RoundHistoryUpdated', (history) => {
        renderRoundHistory(history);
        renderStatistics(history);
    });

    connection.on('RoundNumberUpdated', (roundNumber) => {
        currentRoundNumber = roundNumber || currentRoundNumber;
        updateStoryDisplay(currentStory);
    });

    connection.on('SetFacilitatorStatus', (isFacilitator) => {
        const wasFacilitator = isFacilitatorState;
        isFacilitatorState = isFacilitator;

        const storyInputs = document.getElementById('storyInputs');
        const facilitatorControls = document.getElementById('facilitatorControls');
        const hideStoryToggleContainer = document.getElementById('hideStoryToggleContainer');

        if (isFacilitator) {
            storyInputs?.classList.remove('hidden');
            facilitatorControls?.classList.remove('hidden');
            hideStoryToggleContainer?.classList.remove('hidden');

            if (!wasFacilitator) {
                showToast('Jij bent nu de man, de grote baas, de nieuwe leider!', 'success');
            }
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

    connection.on('AutoStartNewRoundToggled', (autoStart) => {
        if (autoStartNewRoundToggle) {
            autoStartNewRoundToggle.checked = autoStart;
        }

        if (autoStart) {
            autoStartIndicator?.classList.remove('hidden');
            autoStartIndicator?.classList.add('flex');
        } else {
            autoStartIndicator?.classList.add('hidden');
            autoStartIndicator?.classList.remove('flex');
        }
    });

    connection.on('AutoStartNewRoundScheduled', (seconds) => {
        const delaySeconds = Number.isFinite(seconds) ? seconds : 5;
        showToast(`Nieuwe ronde start automatisch over ${delaySeconds} seconden`, 'info');
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

    if (autoStartNewRoundToggle) {
        autoStartNewRoundToggle.addEventListener('change', () => {
            const autoStart = autoStartNewRoundToggle.checked;
            connection.invoke('SetAutoStartNewRound', sessionId, autoStart).catch(err => {
                console.error('Error setting auto-start new round:', err);
                showToast('Kon auto nieuwe ronde niet instellen', 'error');
            });

            if (autoStart) {
                autoStartIndicator?.classList.remove('hidden');
                autoStartIndicator?.classList.add('flex');
            } else {
                autoStartIndicator?.classList.add('hidden');
                autoStartIndicator?.classList.remove('flex');
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

    const motivateBtn = document.getElementById('motivateBtn');
    motivateBtn?.addEventListener('click', () => {
        connection.invoke('PlayMotivation', sessionId).catch(err => {
            console.error('Error playing motivation:', err);
        });
    });

    document.querySelectorAll('.poker-card').forEach(card => {
        card.addEventListener('click', () => {
            const value = card.dataset.value;
            if (currentVote === value) {
                if (countdownActive) return;
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

        const hasStory = story && story.title && story.title.trim().length > 0;
        if (titleEl) {
            titleEl.textContent = hasStory ? story.title : `Ronde ${currentRoundNumber}`;
        }
        if (descriptionEl) {
            descriptionEl.textContent = hasStory ? (story.description || '') : '';
        }
    }

    function updateVoteStatus(votes, participants) {
        const votedParticipantsEl = document.getElementById('votedParticipants');
        const pendingParticipantsEl = document.getElementById('pendingParticipants');
        const progressBar = document.getElementById('votingProgress');

        const participantList = participants || [];
        const votedIds = new Set(getVotedConnectionIds(votes));
        const votedParticipants = participantList.filter(participant => votedIds.has(participant.connectionId));
        const pendingParticipants = participantList.filter(participant => !votedIds.has(participant.connectionId));

        const voteCount = votedParticipants.length;
        const total = participantList.length;

        if (votedParticipantsEl) {
            votedParticipantsEl.textContent = votedParticipants.length > 0
                ? votedParticipants.map(participant => participant.name).join(', ')
                : 'Niemand';
        }

        if (pendingParticipantsEl) {
            pendingParticipantsEl.textContent = pendingParticipants.length > 0
                ? pendingParticipants.map(participant => participant.name).join(', ')
                : 'Niemand';
        }

        if (progressBar) {
            const percentage = total > 0 ? (voteCount / total) * 100 : 0;
            progressBar.style.width = `${percentage}%`;
        }
    }

    function getVotedConnectionIds(votes) {
        if (!votes) {
            return [];
        }

        if (Array.isArray(votes)) {
            return votes
                .map(vote => typeof vote === 'string' ? vote : vote?.participantConnectionId)
                .filter(Boolean);
        }

        if (typeof votes === 'object') {
            return Object.keys(votes);
        }

        return [];
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

    function shouldCelebrate(votes) {
        if (!votes || votes.length < 1) {
            return false;
        }

        const normalized = votes.map(vote => `${vote.value ?? ''}`.trim());
        if (normalized.some(value => value.length === 0)) {
            return false;
        }

        const first = normalized[0];
        return normalized.every(value => value === first);
    }

    function launchConfetti() {
        const existing = document.getElementById('confetti-canvas');
        if (existing) {
            existing.remove();
        }

        const canvas = document.createElement('canvas');
        canvas.id = 'confetti-canvas';
        canvas.style.position = 'fixed';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.pointerEvents = 'none';
        canvas.style.zIndex = '100';
        document.body.appendChild(canvas);

        const ctx = canvas.getContext('2d');
        const density = 140;
        const colors = ['#F59E0B', '#10B981', '#3B82F6', '#EC4899', '#A855F7', '#F97316'];
        let particles = [];
        let animationFrame = null;

        function resizeCanvas() {
            const dpr = window.devicePixelRatio || 1;
            canvas.width = window.innerWidth * dpr;
            canvas.height = window.innerHeight * dpr;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }

        function createParticles() {
            particles = Array.from({ length: density }, () => ({
                x: Math.random() * window.innerWidth,
                y: -20 - Math.random() * window.innerHeight * 0.3,
                width: 6 + Math.random() * 6,
                height: 8 + Math.random() * 10,
                color: colors[Math.floor(Math.random() * colors.length)],
                rotation: Math.random() * Math.PI,
                rotationSpeed: (Math.random() - 0.5) * 0.2,
                velocityX: (Math.random() - 0.5) * 2.2,
                velocityY: 2.5 + Math.random() * 3.5,
                gravity: 0.06 + Math.random() * 0.08
            }));
        }

        function draw() {
            ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
            particles.forEach(particle => {
                ctx.save();
                ctx.translate(particle.x, particle.y);
                ctx.rotate(particle.rotation);
                ctx.fillStyle = particle.color;
                ctx.fillRect(-particle.width / 2, -particle.height / 2, particle.width, particle.height);
                ctx.restore();
            });
        }

        function update() {
            particles.forEach(particle => {
                particle.x += particle.velocityX;
                particle.y += particle.velocityY;
                particle.velocityY += particle.gravity;
                particle.rotation += particle.rotationSpeed;
            });
        }

        function tick() {
            update();
            draw();
            animationFrame = requestAnimationFrame(tick);
        }

        resizeCanvas();
        createParticles();
        tick();

        const cleanup = () => {
            if (animationFrame) {
                cancelAnimationFrame(animationFrame);
            }
            canvas.remove();
            window.removeEventListener('resize', resizeCanvas);
        };

        window.addEventListener('resize', resizeCanvas);
        setTimeout(cleanup, 2200);
    }

    function renderRoundHistory(rounds) {
        const container = document.getElementById('previousRoundsContainer');
        if (!container) return;

        if (!rounds || rounds.length === 0) {
            container.innerHTML = `
                <div class="text-white/60 text-center py-6">
                    Nog geen resultaten
                </div>
            `;
            return;
        }

        container.innerHTML = rounds.map((round, roundIndex) => {
            const title = round.title && round.title.trim()
                ? round.title
                : (round.roundNumber ? `Ronde ${round.roundNumber}` : 'Geen story');
            const description = round.description && round.description.trim() ? round.description : '';
            const votes = round.votes || [];

            const voteCards = votes.map(vote => `
                <div class="bg-white rounded-lg p-3 text-center shadow-md">
                    <div class="text-xs font-medium text-slate-500 mb-1">${vote.participantName}</div>
                    <div class="text-2xl font-bold text-slate-900">${vote.value}</div>
                </div>
            `).join('');

            return `
                <div class="bg-white/10 rounded-xl p-4 border border-white/10" style="animation-delay: ${roundIndex * 0.05}s">
                    <div class="text-white font-semibold text-base">${title}</div>
                    ${description ? `<div class="text-white/70 text-sm mt-1">${description}</div>` : ''}
                    <div class="grid grid-cols-2 gap-2 mt-3">
                        ${voteCards}
                    </div>
                </div>
            `;
        }).join('');
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
        countdownActive = true;
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
        countdownActive = false;
        const container = document.getElementById('countdownContainer');
        if (container) {
            container.classList.add('hidden');
        }
        if (countdownTimer) {
            clearInterval(countdownTimer);
            countdownTimer = null;
        }
    }

    function resetMotivateTimer() {
        clearTimeout(motivateTimer);
        hideMotivateBtn();

        const participants = window.participants || [];
        const votedCount = Object.keys(currentVotes).length;

        // Only start timer if some (but not all) have voted
        if (votedCount === 0 || votedCount >= participants.length) return;

        motivateTimer = setTimeout(() => {
            // Show button only if current user has voted
            if (currentVote !== null) {
                const btn = document.getElementById('motivateBtn');
                btn?.classList.remove('hidden');
            }
        }, 15000);
    }

    function clearMotivateTimer() {
        clearTimeout(motivateTimer);
        motivateTimer = null;
        hideMotivateBtn();
    }

    function hideMotivateBtn() {
        const btn = document.getElementById('motivateBtn');
        btn?.classList.add('hidden');
    }

    function computeStatistics(rounds) {
        if (!rounds || rounds.length < 2) return null;

        function numericVotes(round) {
            return round.votes
                .map(v => ({ name: v.participantName, value: cardValueToNumber(v.value), raw: v.value, votedAt: v.votedAt }))
                .filter(v => v.value !== null);
        }

        function median(nums) {
            if (nums.length === 0) return 0;
            const sorted = [...nums].sort((a, b) => a - b);
            const mid = Math.floor(sorted.length / 2);
            return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
        }

        function spread(nums) {
            if (nums.length < 2) return 0;
            return Math.max(...nums) - Math.min(...nums);
        }

        function mode(arr) {
            const freq = {};
            arr.forEach(v => { freq[v] = (freq[v] || 0) + 1; });
            let maxCount = 0, modeVal = null;
            for (const [val, count] of Object.entries(freq)) {
                if (count > maxCount) { maxCount = count; modeVal = val; }
            }
            return modeVal;
        }

        const roundData = rounds.map(r => {
            const nv = numericVotes(r);
            const values = nv.map(v => v.value);
            return {
                round: r,
                numericVotes: nv,
                values,
                median: median(values),
                spread: spread(values),
                isConsensus: new Set(nv.map(v => v.raw)).size === 1 && nv.length > 0
            };
        });

        const totalStoryPoints = roundData.reduce((sum, rd) => sum + rd.median, 0);
        const consensusRounds = roundData.filter(rd => rd.isConsensus).length;
        const nonConsensusRounds = roundData.length - consensusRounds;
        const avgSpread = roundData.reduce((sum, rd) => sum + rd.spread, 0) / roundData.length;

        const participantData = {};
        roundData.forEach(rd => {
            const majorityValue = mode(rd.numericVotes.map(v => v.raw));
            const voteTimes = rd.round.votes
                .map(v => v.votedAt ? new Date(v.votedAt).getTime() : null)
                .filter(t => t !== null);
            const firstVoteTime = voteTimes.length > 0 ? Math.min(...voteTimes) : null;

            rd.numericVotes.forEach(v => {
                if (!participantData[v.name]) {
                    participantData[v.name] = { total: 0, count: 0, deviationSum: 0, majorityMatches: 0, cards: [], totalVoteDelay: 0, voteDelayCount: 0 };
                }
                const pd = participantData[v.name];
                pd.total += v.value;
                pd.count += 1;
                pd.deviationSum += Math.abs(v.value - rd.median);
                if (v.raw === majorityValue) pd.majorityMatches += 1;
                pd.cards.push(v.raw);

                if (firstVoteTime !== null && v.votedAt) {
                    const voteTime = new Date(v.votedAt).getTime();
                    pd.totalVoteDelay += (voteTime - firstVoteTime) / 1000;
                    pd.voteDelayCount += 1;
                }
            });
        });

        const participants = Object.entries(participantData)
            .filter(([, d]) => d.count >= 2)
            .map(([name, d]) => ({
                name,
                avg: d.total / d.count,
                avgDeviation: d.deviationSum / d.count,
                conformity: d.majorityMatches / d.count,
                favoriteCard: mode(d.cards),
                count: d.count,
                avgVoteDelay: d.voteDelayCount > 0 ? d.totalVoteDelay / d.voteDelayCount : 0
            }));

        const optimist = participants.length > 0 ? participants.reduce((a, b) => a.avg > b.avg ? a : b) : null;
        const pessimist = participants.length > 0 ? participants.reduce((a, b) => a.avg < b.avg ? a : b) : null;
        const rebel = participants.length > 0 ? participants.reduce((a, b) => a.avgDeviation > b.avgDeviation ? a : b) : null;
        const conformist = participants.length > 0 ? participants.reduce((a, b) => a.conformity > b.conformity ? a : b) : null;
        console.log('Vote delays:', participants.map(p => ({ name: p.name, avgVoteDelay: p.avgVoteDelay })));
        console.log('First round vote times:', rounds[0]?.votes?.map(v => ({ name: v.participantName, votedAt: v.votedAt })));
        const slowpoke = participants.filter(p => p.avgVoteDelay > 0).length > 0
            ? participants.filter(p => p.avgVoteDelay > 0).reduce((a, b) => a.avgVoteDelay > b.avgVoteDelay ? a : b)
            : null;
        const biggestDisagreement = roundData.reduce((a, b) => a.spread > b.spread ? a : b);
        const allCards = roundData.flatMap(rd => rd.numericVotes.map(v => v.raw));
        const mostChosenCard = mode(allCards);
        const consensusRatio = (consensusRounds / roundData.length) * 100;

        return {
            roundCount: rounds.length,
            totalStoryPoints,
            consensusRounds,
            nonConsensusRounds,
            avgSpread,
            optimist,
            pessimist,
            rebel,
            conformist,
            slowpoke,
            participants,
            biggestDisagreement,
            mostChosenCard,
            consensusRatio
        };
    }

    function renderStatistics(rounds) {
        const section = document.getElementById('statisticsSection');
        if (!section) return;

        const stats = computeStatistics(rounds);
        if (!stats) {
            section.classList.add('hidden');
            return;
        }
        section.classList.remove('hidden');

        document.getElementById('statsRoundCount').textContent =
            `Gebaseerd op de laatste ${stats.roundCount} rondes`;

        document.getElementById('statsOverview').innerHTML = `
            <div class="bg-white/10 rounded-xl p-3 border border-white/10 text-center">
                <div class="text-2xl font-bold text-white">${stats.totalStoryPoints % 1 === 0 ? stats.totalStoryPoints : stats.totalStoryPoints.toFixed(1)}</div>
                <div class="text-white/60 text-xs mt-1">Story points (totaal)</div>
            </div>
            <div class="bg-white/10 rounded-xl p-3 border border-white/10 text-center">
                <div class="text-2xl font-bold text-white">${stats.consensusRatio.toFixed(0)}%</div>
                <div class="text-white/60 text-xs mt-1">Consensus ratio</div>
            </div>
            <div class="bg-white/10 rounded-xl p-3 border border-white/10 text-center">
                <div class="text-2xl font-bold text-white">${stats.avgSpread.toFixed(1)}</div>
                <div class="text-white/60 text-xs mt-1">Gem. spreiding</div>
            </div>
            <div class="bg-white/10 rounded-xl p-3 border border-white/10 text-center">
                <div class="text-2xl font-bold text-white">${stats.mostChosenCard || '-'}</div>
                <div class="text-white/60 text-xs mt-1">Populairste kaart</div>
            </div>
        `;

        const awards = [
            stats.optimist ? { emoji: '🌞', title: 'De Optimist', desc: 'Stemt gemiddeld het hoogst', name: stats.optimist.name, detail: `gem. ${stats.optimist.avg.toFixed(1)}` } : null,
            stats.pessimist ? { emoji: '🌧️', title: 'De Pessimist', desc: 'Stemt gemiddeld het laagst', name: stats.pessimist.name, detail: `gem. ${stats.pessimist.avg.toFixed(1)}` } : null,
            stats.rebel ? { emoji: '🎸', title: 'De Rebel', desc: 'Wijkt het meest af van de groep', name: stats.rebel.name, detail: `afwijking ${stats.rebel.avgDeviation.toFixed(1)}` } : null,
            stats.conformist ? { emoji: '🤝', title: 'De Conformist', desc: 'Stemt het vaakst met de meerderheid', name: stats.conformist.name, detail: `${(stats.conformist.conformity * 100).toFixed(0)}% met meerderheid` } : null,
            stats.slowpoke ? { emoji: '🐌', title: 'De Slowpoke', desc: 'Doet het langst over stemmen', name: stats.slowpoke.name, detail: `gem. ${stats.slowpoke.avgVoteDelay.toFixed(0)}s` } : null,
        ].filter(Boolean);

        document.getElementById('statsAwards').innerHTML = awards.map(a => `
            <div class="bg-white/10 rounded-lg p-3 border border-white/10 flex items-center gap-3">
                <span class="text-2xl">${a.emoji}</span>
                <div class="flex-1 min-w-0">
                    <div class="text-white font-semibold text-sm">${a.title}</div>
                    <div class="text-white/50 text-xs">${a.desc}</div>
                    <div class="text-white/80 text-xs truncate mt-0.5">${a.name}</div>
                </div>
                <div class="text-white/50 text-xs">${a.detail}</div>
            </div>
        `).join('');

        const favoriteCards = stats.participants.map(p => `
            <span class="inline-flex items-center gap-1 bg-white/10 rounded-lg px-2 py-1 text-xs border border-white/10">
                <span class="text-white/80">${p.name}:</span>
                <span class="text-white font-bold">${p.favoriteCard}</span>
            </span>
        `).join('');

        const bdRound = stats.biggestDisagreement.round;
        const bdTitle = bdRound.title || `Ronde ${bdRound.roundNumber}`;

        document.getElementById('statsRounds').innerHTML = `
            <div class="bg-white/10 rounded-lg p-3 border border-white/10">
                <div class="text-white/60 text-xs mb-1">Grootste onenigheid</div>
                <div class="text-white font-semibold text-sm">${bdTitle} <span class="text-white/50 font-normal">(spreiding: ${stats.biggestDisagreement.spread})</span></div>
            </div>
            <div class="bg-white/10 rounded-lg p-3 border border-white/10">
                <div class="text-white/60 text-xs mb-1">Consensus rondes</div>
                <div class="text-white font-semibold text-sm">${stats.consensusRounds} van ${stats.roundCount} <span class="text-white/50 font-normal">(${stats.nonConsensusRounds} zonder)</span></div>
            </div>
            <div class="bg-white/10 rounded-lg p-3 border border-white/10">
                <div class="text-white/60 text-xs mb-2">Favoriete kaarten</div>
                <div class="flex flex-wrap gap-1">${favoriteCards}</div>
            </div>
        `;
    }
});
