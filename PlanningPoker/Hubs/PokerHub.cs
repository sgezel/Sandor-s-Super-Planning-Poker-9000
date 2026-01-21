using Microsoft.AspNetCore.SignalR;
using PlanningPoker.Services;
using PlanningPoker.Models;

namespace PlanningPoker.Hubs
{
    public class PokerHub : Hub
    {
        private readonly SessionService _sessionService;

        public PokerHub(SessionService sessionService)
        {
            _sessionService = sessionService;
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

            await Clients.Group(sessionId).SendAsync("ParticipantsUpdated", session.Participants);
            await Clients.Caller.SendAsync("SessionData", session);
            await Clients.Caller.SendAsync("SetFacilitatorStatus", isActuallyFacilitator);
        }

        public async Task SetStory(string sessionId, string title, string description)
        {
            if (!_sessionService.IsFacilitator(sessionId, Context.ConnectionId))
            {
                return;
            }

            var story = new Models.UserStory
            {
                Title = title,
                Description = description
            };

            _sessionService.SetStory(sessionId, story);

            var session = _sessionService.GetSession(sessionId);
            await Clients.Group(sessionId).SendAsync("StoryUpdated", story);
            await Clients.Group(sessionId).SendAsync("VotesCleared");
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

            await Clients.Group(sessionId).SendAsync("VoteCast", voteCount, participantCount);

            if (session != null &&
                session.AutoRevealVotes &&
                !session.IsVotesRevealed &&
                voteCount == participantCount &&
                participantCount > 0)
            {
                await Task.Delay(1500);
                _sessionService.RevealVotes(sessionId);

                var votesWithNames = session.Votes.Select(v => new
                {
                    ParticipantName = session.Participants.FirstOrDefault(p => p.ConnectionId == v.Value.ParticipantConnectionId)?.Name ?? "Unknown",
                    Value = v.Value.Value
                }).ToList();

                await Clients.Group(sessionId).SendAsync("VotesRevealed", votesWithNames);
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

            await Clients.Group(sessionId).SendAsync("VotesRevealed", votesWithNames);
        }

        public async Task ResetVoting(string sessionId)
        {
            if (!_sessionService.IsFacilitator(sessionId, Context.ConnectionId))
            {
                return;
            }

            _sessionService.ResetVoting(sessionId);
            await Clients.Group(sessionId).SendAsync("VotingReset");
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
                await Clients.Group(sessionId).SendAsync("AutoRevealToggled", autoReveal);
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
                await Clients.Group(sessionId).SendAsync("StoryDescriptionToggled", hide);
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
                        _sessionService.RemoveParticipant(sessionPair.Key, Context.ConnectionId);
                        await Groups.RemoveFromGroupAsync(Context.ConnectionId, sessionPair.Key);
                        await Clients.Group(sessionPair.Key).SendAsync("ParticipantsUpdated", session.Participants);
                        break;
                    }
                }
            }

            await base.OnDisconnectedAsync(exception);
        }
    }
}