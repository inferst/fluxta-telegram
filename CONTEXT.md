# Telegram

The Fluxta plugin that posts to Telegram. Its Actions send messages to
Telegram channels, groups and people through bots the user owns, and hand
back what a later step needs to edit them.

Fluxta's own words — Action, Run Variable, Global Variable, Plugin Editor,
Action Editor, Plugin settings, External Connection — mean what Fluxta's
[Terminology](https://fluxta.app/docs/plugins/getting-started/terminology)
says and are not redefined here. Telegram's nouns below are used as the Bot
API uses them, narrowed to what this plugin does with them.

## Language

### Chats

**Chat**:
One Telegram destination the plugin posts to — a channel, a group or a person
— together with the token of the bot that posts there: a name, the chat as the
Bot API addresses it (`@username` or a numeric id such as `-1001234567890`),
and a Bot Token, under an id the plugin chooses. Configured in the Plugin
Editor, persisted in Plugin settings, and reported to Fluxta with
`setConnections` as one External Connection, connected while its Chat Status
is `ready`. Several Chats may share one Bot; each still carries the token.
An Action whose settings name no Chat posts to the sole configured one.
_Avoid_: channel (one kind of Chat), connection (Fluxta's word for a
transport link — a Chat reaches Fluxta as an External Connection),
destination, target.

**Chat Status**:
What the plugin last learned about a Chat from Telegram: `checking`, `ready`
with the chat's title, or `error` with what to fix. A Chat is checked when the
plugin starts, when its chat or token changes, and when the user presses
Check: the token must belong to a Bot, the Bot must see the chat, and it must
be allowed to post there — in a channel that means an admin with "Post
messages". Renaming a Chat checks nothing.
_Avoid_: online/offline, health.

**Bot**:
The Telegram bot account a Chat posts as, created with @BotFather and known
to the Bot API by its Bot Token. It posts in its own name, never the user's.
_Avoid_: account, user.

**Bot Token**:
The secret @BotFather hands out for a Bot (`123456789:AAH…`). Kept only in
Plugin settings: an editor sees whether one is stored, never the token, and
no log or error message ever contains it. On edit, a blank token field keeps
the stored one.
_Avoid_: key, password, API key.

### Messages

**Message**:
What Send Message posts to a Chat and Edit Message rewrites: plain text,
without Telegram's HTML or Markdown — the host substitutes Run Variables into
the text before the plugin sees it, so markup could be broken by any
substituted value. Identified by its message id, which is unique only within
its chat: editing a Message names both the Chat and the id. Send Message
produces the id and the text as sent; keeping the id in a Global Variable is
how a later run edits the Message. Edit Message replaces the whole text: the
Bot API cannot read a Message back, so the plugin never knows what it says now
and cannot append to it.
_Avoid_: post (a Message in a channel is often called one; the plugin says
Message), update.
