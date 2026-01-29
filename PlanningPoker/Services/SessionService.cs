using PlanningPoker.Models;
using System.Collections.Concurrent;
using System.Diagnostics.CodeAnalysis;

#pragma warning disable CS8604

namespace PlanningPoker.Services
{
    public class SessionService
    {
        private static readonly ConcurrentDictionary<string, Session> _sessions = new();

        public Session CreateSession(string sessionId)
        {
            var session = new Session
            {
                SessionId = sessionId,
                CreatedAt = DateTime.UtcNow,
                RoundNumber = 1
            };
            _sessions[sessionId] = session;
            return session;
        }

        public Session? GetSession(string sessionId)
        {
            _sessions.TryGetValue(sessionId, out var session);
            return session;
        }

        public bool SessionExists(string sessionId)
        {
            if (string.IsNullOrEmpty(sessionId))
            {
                return false;
            }
            return _sessions.ContainsKey(sessionId);
        }

        public void AddParticipant(string sessionId, Participant participant)
        {
            if (_sessions.TryGetValue(sessionId, out var session))
            {
                var existing = session.Participants.FirstOrDefault(p => p.ConnectionId == participant.ConnectionId);
                if (existing == null)
                {
                    session.Participants.Add(participant);
                }
                else
                {
                    existing.Name = participant.Name;
                }
            }
        }

        public bool IsFacilitator(string sessionId, string connectionId)
        {
            if (_sessions.TryGetValue(sessionId, out var session))
            {
                return session.FacilitatorConnectionId == connectionId;
            }
            return false;
        }

        public void SetFacilitator(string sessionId, string connectionId)
        {
            if (_sessions.TryGetValue(sessionId, out var session))
            {
                if (string.IsNullOrEmpty(session.FacilitatorConnectionId))
                {
                    session.FacilitatorConnectionId = connectionId;
                }
            }
        }

        public Participant? AssignRandomFacilitator(string sessionId)
        {
            if (_sessions.TryGetValue(sessionId, out var session))
            {
                if (session.Participants.Count == 0)
                {
                    session.FacilitatorConnectionId = string.Empty;
                    return null;
                }

                var index = Random.Shared.Next(session.Participants.Count);
                var newFacilitator = session.Participants[index];

                session.FacilitatorConnectionId = newFacilitator.ConnectionId;
                foreach (var participant in session.Participants)
                {
                    participant.IsFacilitator = participant.ConnectionId == newFacilitator.ConnectionId;
                }

                return newFacilitator;
            }

            return null;
        }

        public void RemoveParticipant(string sessionId, string connectionId)
        {
            if (_sessions.TryGetValue(sessionId, out var session))
            {
                session.Participants.RemoveAll(p => p.ConnectionId == connectionId);
                session.Votes.Remove(connectionId);
            }
        }

        public void SetStory(string sessionId, UserStory story)
        {
            if (_sessions.TryGetValue(sessionId, out var session))
            {
                session.CurrentStory = story;
                session.Votes.Clear();
                session.IsVotesRevealed = false;
            }
        }

        public void CastVote(string sessionId, Vote vote)
        {
            if (_sessions.TryGetValue(sessionId, out var session))
            {
                session.Votes[vote.ParticipantConnectionId] = vote;
            }
        }

        public void RevealVotes(string sessionId)
        {
            if (_sessions.TryGetValue(sessionId, out var session))
            {
                session.IsVotesRevealed = true;
            }
        }

        public void ResetVoting(string sessionId)
        {
            if (_sessions.TryGetValue(sessionId, out var session))
            {
                if (session.IsVotesRevealed && session.Votes.Count > 0)
                {
                    var voteResults = session.Votes.Values
                        .Where(vote => !string.IsNullOrWhiteSpace(vote.Value))
                        .Select(vote => new RoundVoteResult
                        {
                            ParticipantName = session.Participants.FirstOrDefault(p => p.ConnectionId == vote.ParticipantConnectionId)?.Name ?? "Unknown",
                            Value = vote.Value
                        }).ToList();

                    if (voteResults.Count > 0)
                    {
                        var roundTitle = session.CurrentStory?.Title;
                        if (string.IsNullOrWhiteSpace(roundTitle))
                        {
                            roundTitle = $"Ronde {session.RoundNumber}";
                        }

                        var roundResult = new RoundResult
                        {
                            Title = roundTitle,
                            Description = session.CurrentStory?.Description ?? string.Empty,
                            Votes = voteResults,
                            RoundNumber = session.RoundNumber,
                            CompletedAt = DateTime.UtcNow
                        };

                        session.PreviousRounds.Insert(0, roundResult);
                        if (session.PreviousRounds.Count > 5)
                        {
                            session.PreviousRounds.RemoveRange(5, session.PreviousRounds.Count - 5);
                        }
                    }
                }

                if (session.CurrentStory == null || string.IsNullOrWhiteSpace(session.CurrentStory.Title))
                {
                    session.RoundNumber += 1;
                }

                session.Votes.Clear();
                session.IsVotesRevealed = false;
            }
        }

        public int GetVoteCount(string sessionId)
        {
            if (_sessions.TryGetValue(sessionId, out var session))
            {
                return session.Votes.Count;
            }
            return 0;
        }

        public int GetParticipantCount(string sessionId)
        {
            if (_sessions.TryGetValue(sessionId, out var session))
            {
                return session.Participants.Count;
            }
            return 0;
        }

        public void SetAutoReveal(string sessionId, bool autoReveal)
        {
            if (_sessions.TryGetValue(sessionId, out var session))
            {
                session.AutoRevealVotes = autoReveal;
            }
        }

        public bool GetAutoReveal([NotNullWhen(true)] string sessionId)
        {
            if (string.IsNullOrEmpty(sessionId))
            {
                return false;
            }
            _sessions.TryGetValue(sessionId, out var session);
            return session?.AutoRevealVotes ?? false;
        }

        public void SetHideStoryDescription(string sessionId, bool hide)
        {
            if (_sessions.TryGetValue(sessionId, out var session))
            {
                session.HideStoryDescription = hide;
            }
        }

        public bool GetHideStoryDescription([NotNullWhen(true)] string sessionId)
        {
            if (string.IsNullOrEmpty(sessionId))
            {
                return false;
            }
            _sessions.TryGetValue(sessionId, out var session);
            return session?.HideStoryDescription ?? false;
        }
    }
}
