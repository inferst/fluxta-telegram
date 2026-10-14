/**
 * Send Message's settings, as its Action Editor saves them.
 *
 * `chat` is a Chat's id; unset means the sole configured Chat, so settings
 * saved before a second Chat existed keep working. `text` is edited through
 * a `TemplateField`, so by the time the sidecar reads it the host may have
 * substituted it into a number or a boolean — read it with `templatedText`.
 */
export type SendMessageSettings = {
  chat?: string;
  text?: string;
};
