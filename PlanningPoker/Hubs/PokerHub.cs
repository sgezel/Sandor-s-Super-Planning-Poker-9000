using Microsoft.AspNetCore.SignalR;
using PlanningPoker.Services;
using PlanningPoker.Models;

namespace PlanningPoker.Hubs
{
    public class PokerHub : Hub
    {
        private readonly SessionService _sessionService;
        private readonly IHubContext<PokerHub> _hubContext;
        private static readonly Dictionary<string, CancellationTokenSource> _countdownTokens = new();
        private static readonly Dictionary<string, object> _sessionLocks = new();

        public PokerHub(SessionService sessionService, IHubContext<PokerHub> hubContext)
        {
            _sessionService = sessionService;
            _hubContext = hubContext;
        }

        public async Task JoinSession(string sessionId, string userName, bool isFacilitator = false)
        {
            var session = _sessionService.GetSession(sessionId);
            if (session == null)
            {
                return;
            }

            _sessionService.SetFacilitator(sessionId, Context.ConnectionId);

            var isActuallyFacilitator = _sessionService.IsFacilitator(sessionId, Context.ConnectionId);

            var participant = new Participant
            {
                ConnectionId = Context.ConnectionId,
                Name = userName,
                IsFacilitator = isActuallyFacilitator
            };

            _sessionService.AddParticipant(sessionId, participant);
            await Groups.AddToGroupAsync(Context.ConnectionId, sessionId);

            await _hubContext.Clients.Group(sessionId).SendAsync("ParticipantsUpdated", session.Participants);
            await Clients.Caller.SendAsync("SessionData", session);
            await Clients.Caller.SendAsync("SetFacilitatorStatus", isActuallyFacilitator);
        }

        public async Task SetStory(string sessionId, string title, string description)
        {
            if (!_sessionService.IsFacilitator(sessionId, Context.ConnectionId))
            {
                return;
            }

            CancelCountdown(sessionId);

            var story = new Models.UserStory
            {
                Title = title,
                Description = description
            };

            _sessionService.SetStory(sessionId, story);

            var session = _sessionService.GetSession(sessionId);
            await _hubContext.Clients.Group(sessionId).SendAsync("StoryUpdated", story);
            await _hubContext.Clients.Group(sessionId).SendAsync("VotesCleared");
        }

        public async Task CastVote(string sessionId, string voteValue)
        {
            var vote = new Models.Vote
            {
                ParticipantConnectionId = Context.ConnectionId,
                Value = voteValue
            };

            _sessionService.CastVote(sessionId, vote);

            var voteCount = _sessionService.GetVoteCount(sessionId);
            var participantCount = _sessionService.GetParticipantCount(sessionId);
            var session = _sessionService.GetSession(sessionId);

            await _hubContext.Clients.Group(sessionId).SendAsync("VoteCast", voteCount, participantCount);

            if (session != null &&
                session.AutoRevealVotes &&
                !session.IsVotesRevealed &&
                voteCount == participantCount &&
                participantCount > 0)
            {
                if (_countdownTokens.ContainsKey(sessionId))
                {
                    _countdownTokens[sessionId].Cancel();
                    _countdownTokens.Remove(sessionId);
                }

                var cts = new CancellationTokenSource();
                _countdownTokens[sessionId] = cts;

                await _hubContext.Clients.Group(sessionId).SendAsync("CountdownStarted");

                _ = Task.Run(async () =>
                {
                    try
                    {
                        await Task.Delay(3000, cts.Token);
                        _countdownTokens.Remove(sessionId);

                        object sessionLock;
                        if (!_sessionLocks.TryGetValue(sessionId, out sessionLock))
                        {
                            sessionLock = new object();
                            _sessionLocks[sessionId] = sessionLock;
                        }

                        List<object>? votesToSend = null;
                        lock (sessionLock)
                        {
                            var updatedSession = _sessionService.GetSession(sessionId);
                            Console.WriteLine($"Countdown finished for session {sessionId}, IsVotesRevealed: {updatedSession?.IsVotesRevealed}, Votes count: {updatedSession?.Votes.Count}");

                            if (updatedSession != null)
                            {
                                _sessionService.RevealVotes(sessionId);

                                votesToSend = updatedSession.Votes.Select(v => new
                                {
                                    ParticipantName = updatedSession.Participants.FirstOrDefault(p => p.ConnectionId == v.Value.ParticipantConnectionId)?.Name ?? "Unknown",
                                    Value = v.Value.Value
                                }).ToList<object>();
                                Console.WriteLine($"Votes to send: {votesToSend?.Count}");
                            }
                            else
                            {
                                Console.WriteLine("Session is null!");
                            }
                        }

                        if (votesToSend != null)
                        {
                            Console.WriteLine($"Sending VotesRevealed to group {sessionId}");
                            await _hubContext.Clients.Group(sessionId).SendAsync("VotesRevealed", votesToSend);
                        }
                        else
                        {
                            Console.WriteLine("votesToSend is null, sending empty votes");
                            await _hubContext.Clients.Group(sessionId).SendAsync("VotesRevealed", new List<object>());
                        }
                    }
                    catch (OperationCanceledException)
                    {
                        Console.WriteLine($"Countdown canceled for session {sessionId}");
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine($"Error in countdown: {ex.Message}");
                    }
                });
            }
        }

        public async Task RevealVotes(string sessionId)
        {
            if (!_sessionService.IsFacilitator(sessionId, Context.ConnectionId))
            {
                return;
            }

            _sessionService.RevealVotes(sessionId);
            var session = _sessionService.GetSession(sessionId);

            if (session == null)
            {
                return;
            }

            var votesWithNames = session.Votes.Select(v => new
            {
                ParticipantName = session.Participants.FirstOrDefault(p => p.ConnectionId == v.Value.ParticipantConnectionId)?.Name ?? "Unknown",
                Value = v.Value.Value
            }).ToList();

            await _hubContext.Clients.Group(sessionId).SendAsync("VotesRevealed", votesWithNames);
        }

        public async Task ResetVoting(string sessionId)
        {
            if (!_sessionService.IsFacilitator(sessionId, Context.ConnectionId))
            {
                return;
            }

            CancelCountdown(sessionId);

            _sessionService.ResetVoting(sessionId);
            await _hubContext.Clients.Group(sessionId).SendAsync("VotingReset");

            var session = _sessionService.GetSession(sessionId);
            if (session != null)
            {
                await _hubContext.Clients.Group(sessionId).SendAsync("RoundHistoryUpdated", session.PreviousRounds);
                await _hubContext.Clients.Group(sessionId).SendAsync("RoundNumberUpdated", session.RoundNumber);
            }
        }

        public async Task SetAutoReveal(string sessionId, bool autoReveal)
        {
            if (!_sessionService.IsFacilitator(sessionId, Context.ConnectionId))
            {
                return;
            }

            _sessionService.SetAutoReveal(sessionId, autoReveal);
            var session = _sessionService.GetSession(sessionId);
            if (session != null)
            {
                await _hubContext.Clients.Group(sessionId).SendAsync("AutoRevealToggled", autoReveal);
            }
        }

        public async Task SetHideStoryDescription(string sessionId, bool hide)
        {
            if (!_sessionService.IsFacilitator(sessionId, Context.ConnectionId))
            {
                return;
            }

            _sessionService.SetHideStoryDescription(sessionId, hide);
            var session = _sessionService.GetSession(sessionId);
            if (session != null)
            {
                await _hubContext.Clients.Group(sessionId).SendAsync("StoryDescriptionToggled", hide);
            }
        }

        private void CancelCountdown(string sessionId)
        {
            if (_countdownTokens.TryGetValue(sessionId, out var cts))
            {
                cts.Cancel();
                _countdownTokens.Remove(sessionId);
            }
        }

        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            var sessions = _sessionService.GetType().GetField("_sessions", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static)?.GetValue(_sessionService) as System.Collections.Concurrent.ConcurrentDictionary<string, Models.Session>;

            if (sessions != null)
            {
                foreach (var sessionPair in sessions)
                {
                    var session = sessionPair.Value;
                    if (session.Participants.Any(p => p.ConnectionId == Context.ConnectionId))
                    {
                        var wasFacilitator = session.FacilitatorConnectionId == Context.ConnectionId;
                        Participant? newFacilitator = null;

                        _sessionService.RemoveParticipant(sessionPair.Key, Context.ConnectionId);
                        await Groups.RemoveFromGroupAsync(Context.ConnectionId, sessionPair.Key);

                        if (wasFacilitator)
                        {
                            newFacilitator = _sessionService.AssignRandomFacilitator(sessionPair.Key);
                        }

                        await _hubContext.Clients.Group(sessionPair.Key).SendAsync("ParticipantsUpdated", session.Participants);

                        if (wasFacilitator && newFacilitator != null)
                        {
                            await _hubContext.Clients.Client(newFacilitator.ConnectionId).SendAsync("SetFacilitatorStatus", true);
                        }
                        break;
                    }
                }
            }

            await base.OnDisconnectedAsync(exception);
        }
    }
}
