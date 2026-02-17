using System.ComponentModel.DataAnnotations;

namespace PlanningPoker.Models
{
    public class Session
    {
        public string SessionId { get; set; } = string.Empty;
        public string FacilitatorConnectionId { get; set; } = string.Empty;
        public List<Participant> Participants { get; set; } = new();
        public UserStory? CurrentStory { get; set; }
        public Dictionary<string, Vote> Votes { get; set; } = new();
        public List<RoundResult> PreviousRounds { get; set; } = new();
        public int RoundNumber { get; set; } = 1;
        public bool IsVotesRevealed { get; set; }
        public bool AutoRevealVotes { get; set; } = false;
        public bool AutoStartNewRound { get; set; } = false;
        public bool HideStoryDescription { get; set; } = false;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }

    public class Participant
    {
        public string ConnectionId { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public bool IsFacilitator { get; set; }
    }

    public class UserStory
    {
        public string Title { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
    }

    public class Vote
    {
        public string ParticipantConnectionId { get; set; } = string.Empty;
        public string Value { get; set; } = string.Empty;
        public DateTime VotedAt { get; set; } = DateTime.UtcNow;
    }

    public class RoundResult
    {
        public string Title { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public List<RoundVoteResult> Votes { get; set; } = new();
        public int RoundNumber { get; set; }
        public DateTime CompletedAt { get; set; } = DateTime.UtcNow;
    }

    public class RoundVoteResult
    {
        public string ParticipantName { get; set; } = string.Empty;
        public string Value { get; set; } = string.Empty;
    }
}
