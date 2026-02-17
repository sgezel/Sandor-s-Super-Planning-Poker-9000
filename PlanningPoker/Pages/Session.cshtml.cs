using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using PlanningPoker.Services;

namespace PlanningPoker.Pages
{
    public class SessionModel : PageModel
    {
        private readonly SessionService _sessionService;
        private readonly ILogger<SessionModel> _logger;

        public string SessionId { get; set; } = string.Empty;
        public string UserName { get; set; } = string.Empty;
        public bool IsFacilitator { get; set; }
        public bool AutoRevealVotes { get; set; }
        public bool AutoStartNewRound { get; set; }

        public SessionModel(SessionService sessionService, ILogger<SessionModel> logger)
        {
            _sessionService = sessionService;
            _logger = logger;
        }

        public void OnGet(string sessionId, string userName, bool isFacilitator)
        {
            SessionId = sessionId ?? string.Empty;
            UserName = userName ?? string.Empty;
            IsFacilitator = isFacilitator;

            if (!string.IsNullOrEmpty(sessionId) && !_sessionService.SessionExists(sessionId))
            {
                _sessionService.CreateSession(sessionId);
            }

            if (!string.IsNullOrEmpty(sessionId))
            {
                AutoRevealVotes = _sessionService.GetAutoReveal(sessionId);
                AutoStartNewRound = _sessionService.GetAutoStartNewRound(sessionId);
            }
        }
    }
}
