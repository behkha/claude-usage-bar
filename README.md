# usage-bar

A mod for Claude Code that draws a band above the prompt with the numbers of the running session.

## What it shows

- **Context:** how full the context window is, with the tokens in it and the window's size.
- **Session:** tokens written and read, the share of reads served from cache, cost, turns, tool calls and time.
- **Limits:** the 5-hour and weekly windows, and the weekly limit your plan keeps for one model (Fable), each with its pace and reset time.
- **Child sessions:** sessions this one started in the desktop app, with what each is doing and which one is waiting for you.
- **Claude FM:** a button that plays and stops the Claude FM stream.

The band has two modes, switched with the half-disc button (◐ / ◑):

- **Glass:** one black card with the context figure, the session's numbers in columns, and the limits on a plate at the right end.
- **Classic:** Clawd beside a row of meters.

In a terminal the band is a few lines of text meters.

## Install

At the prompt of a terminal session:

```
/plugin install usage-bar --marketplace behkha/claude-usage-bar
```

Answer `y` to add the marketplace, then pick a scope.

From a shell:

```
claude plugin install usage-bar --marketplace behkha/claude-usage-bar
```

In the desktop app, where `/plugin` does not run: click + next to the prompt box, then Plugins, Add marketplace with `behkha/claude-usage-bar`, then Add plugin.

## What it does on your machine

Read this before installing: the mod does more than draw.

- **Sets a black look** for the app when a session starts.
- **Reads your account's usage report** from `api.anthropic.com` for the per-model limit, with the session's own credential, which stays with the host. It asks once at session start, at most once a minute after a turn, and every 10 minutes while idle. Nothing is sent anywhere else.
- **Reads local session files** under `~/.claude/sessions`, `~/.claude/projects` and the desktop app's own records, to list child sessions. It runs `ps` and `tail` for that.
- **Claude FM** opens the stream in a Google Chrome window through AppleScript and minimizes it; stopping closes that tab. macOS asks for permission the first time you press the button.
- **Keeps counts** per session in the mod's own store, so a reopened session carries on from where it stood.

Child sessions and Claude FM work on macOS only. Elsewhere those parts stay hidden.

## Develop

Run the mod from its folder while changing it:

```
claude --plugin-dir /path/to/claude-usage-bar
```

Check it with `claude plugin validate .` and, once the engine has laid its types in `.claude-plugin/types/`, `tsc -p .`.

## Credits

The context forecast is adapted from token-weather (anthropics/claude-code-playground, Apache-2.0). Clawd is drawn from Claude Code's own glyph tables.
