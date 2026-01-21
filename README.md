# Planning Poker

Een eenvoudige, moderne Planning Poker webapplicatie voor agile teams om user stories gezamenlijk te schatten.

## ✨ Kenmerken

- **Real-time updates** met SignalR (WebSockets)
- **Moderne UI** met Tailwind CSS
- **Snel en gebruiksvriendelijk** - geen accounts nodig
- **Modified Fibonacci** reeks: 0, ½, 1, 2, 3, 5, 8, 13, 20, 40, 100
- **Real-time stemstatus** - zie wie er heeft gestemd
- **Facilitator controls** - beheer de sessie
- **Volledig responsief** - werkt op desktop en mobiel

## 🚀 Snelle start

### Vereisten

- .NET 8.0 SDK

### Installatie en uitvoering

1. Navigeer naar de projectmap:
    ```bash
    cd PlanningPoker
    ```

2. Herstel dependencies:
   ```bash
   dotnet restore
   ```

3. Bouw het project:
   ```bash
   dotnet build
   ```

4. Start de applicatie:
   ```bash
   dotnet run
   ```

5. Open je browser en ga naar:
   ```
   http://localhost:5000
   ```

## 📖 Gebruik

### Een sessie starten (Facilitator)

1. Vul je naam in
2. Klik op **"Nieuwe sessie aanmaken"**
3. Je wordt automatisch doorverwezen naar de sessiepagina als facilitator
4. Deel de sessie-ID met je teamleden

### Deelnemen aan een sessie

1. Vul je naam in
2. Voer de sessie-ID in
3. Klik op **"Doe mee"**
4. Je wordt doorverwezen naar de sessiepagina

### Een Planning Poker ronde uitvoeren

1. **Facilitator**: Stel een story in door titel en beschrijving in te vullen
2. Klik op **"Story instellen"**
3. **Alle deelnemers**: Kies een kaart door erop te klikken
4. Stemmen zijn verborgen totdat iedereen heeft gestemd
5. **Facilitator**: Klik op **"Toon stemmen"** om de resultaten te zien
6. Discussieer en kom overeenstemming
7. **Facilitator**: Klik op **"Nieuwe ronde"** voor de volgende story

## 🎨 UI Design

De applicatie gebruikt een moderne, schone design met:

- **Gradiënt achtergrond** (indigo en violet)
- **Glassmorphism effecten** voor kaarten
- **Interactieve poker kaarten** met hover en selectie animaties
- **Real-time voortgangsbalk** voor stemstatus
- **Avatar initialen** voor deelnemers met unieke kleuren
- **Toast notificaties** voor feedback
- **Volledig responsief** ontwerp

## 🏗️ Architectuur

### Projectstructuur

```
PlanningPoker/
├── Models/
│   └── Models.cs           # Data modellen
├── Services/
│   └── SessionService.cs    # In-memory sessie beheer
├── Hubs/
│   └── PokerHub.cs         # SignalR Hub voor real-time updates
├── Pages/
│   ├── Index.cshtml         # Homepagina
│   ├── Session.cshtml       # Sessiepagina
│   └── Shared/
│       └── _Layout.cshtml   # Layout met Tailwind CSS
├── wwwroot/
│   ├── css/
│   │   └── site.css        # Custom CSS stijlen
│   └── js/
│       ├── site.js          # Utility functies
│       ├── index.js         # Homepagina logica
│       └── session.js      # Sessiepagina logica
└── Program.cs              # App configuratie
```

### Technologieën

- **Backend**: ASP.NET Core 8.0
- **Real-time**: SignalR (WebSockets)
- **Frontend**: Razor Pages
- **Styling**: Tailwind CSS (via CDN)
- **State Management**: In-memory (ConcurrentDictionary)

### SignalR Events

- `ParticipantsUpdated` - Update deelnemerslijst
- `StoryUpdated` - Nieuwe story ingesteld
- `VoteCast` - Stem uitgebracht (aantal)
- `VotesRevealed` - Alle stemmen onthuld
- `VotingReset` - Nieuwe ronde gestart
- `VotesCleared` - Stemmen gewist
- `SessionData` - Volledige sessiedata (bij join)

## 🔧 Configuratie

De applicatie draait standaard op HTTP. Om HTTPS in te schakelen, pas `appsettings.json` aan:

```json
{
  "Kestrel": {
    "Endpoints": {
      "Https": {
        "Url": "https://localhost:5001"
      }
    }
  }
}
```

## 📝 Out of scope (MVP)

De volgende functionaliteit is bewust niet opgenomen in de MVP:

- Geen gebruikersaccounts of authenticatie
- Geen persistente opslag (in-memory alleen)
- Geen integraties met Jira, Azure DevOps, etc.
- Geen historie of rapportages
- Geen uitgebreide configuratie

## 🚀 Deployment

### Productie

1. Publiceer de applicatie:
   ```bash
   dotnet publish -c Release -o ./publish
   ```

2. Draai de gepubliceerde applicatie:
    ```bash
    cd publish
    dotnet PlanningPoker.dll
    ```

Of gebruik Docker:

```dockerfile
FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
COPY publish .
ENTRYPOINT ["dotnet", "PlanningPoker.dll"]
```

## 📄 Licentie

Dit project is open source en beschikbaar voor gebruik.

## 🤝 Bijdragen

Bijdragen zijn welkom! Maak een fork en stuur een pull request.

## 💡 Tips

- De sessie-ID kan naar het klembord gekopieerd worden door erop te klikken
- Facilitator wordt weergegeven met een ster (★) symbool
- De voortgangsbalk toont hoeveel deelnemers hebben gestemd
- Poker kaarten zijn gekleurd wanneer geselecteerd
- Stemmen worden onthuld met een mooie animatie

## 🐛 Problemen

Bij problemen:
1. Controleer of .NET 8.0 is geïnstalleerd: `dotnet --version`
2. Controleer of poort 5000 vrij is
3. Kijk naar de console logs voor foutmeldingen

## 📞 Support

Voor vragen of problemen, open een issue in de repository.