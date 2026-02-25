# Smiley → Emoji Conversion Reference

Text smileys typed in chat are automatically converted into emoji.
The conversion is defined in [`remarkEmoji.ts`](./remarkEmoji.ts).

## Faces

| Emoji | Shortcode | Smileys |
| ----- | --------- | ------- |
| 🙂 | `:slightly_smiling_face:` | `:)` `:-)` `=)` |
| 😄 | `:smile:` | `:D` `:-D` `=D` `^_^` `^.^` |
| 😁 | `:grin:` | `=]` |
| 😆 | `:laughing:` | `XD` `xD` |
| 😂 | `:joy:` | `:'D` |
| 😅 | `:sweat_smile:` | `:'-)` `:')` |
| 😉 | `:wink:` | `;)` `;-)` |
| 😇 | `:innocent:` | `O:)` `0:)` `O:-)` `0:-)` |
| 😏 | `:smirk:` | `:>` |
| 😎 | `:sunglasses:` | `B)` `8)` `B-)` `8-)` |

## Tongues

| Emoji | Shortcode | Smileys |
| ----- | --------- | ------- |
| 😛 | `:stuck_out_tongue:` | `:P` `:p` `:-P` `:-p` `=P` `=p` |
| 😜 | `:stuck_out_tongue_winking_eye:` | `;P` `;p` `;-P` `;-p` |
| 😝 | `:stuck_out_tongue_closed_eyes:` | `>:P` `>:p` |

## Sad / Negative

| Emoji | Shortcode | Smileys |
| ----- | --------- | ------- |
| 😞 | `:disappointed:` | `:(` `:-(` `=(` `=[` |
| 😔 | `:pensive:` | `:c` |
| 😢 | `:cry:` | `:'(` `:'-(` `:,(` |
| 😭 | `:sob:` | `T_T` |
| 😧 | `:anguished:` | `D:` |
| 😱 | `:scream:` | `D8` |
| 😣 | `:persevere:` | `>_<` `>.<` |

## Angry / Evil

| Emoji | Shortcode | Smileys |
| ----- | --------- | ------- |
| 😠 | `:angry:` | `>:(` `>:-(` |
| 😡 | `:rage:` | `:@` `:-@` |
| 😈 | `:smiling_imp:` | `>:)` `>:-)` `3:)` |
| 👿 | `:imp:` | `>:D` `>:-D` |

## Surprised / Confused / Neutral

| Emoji | Shortcode | Smileys |
| ----- | --------- | ------- |
| 😮 | `:open_mouth:` | `:O` `:o` `:-O` `:-o` `=O` `=o` `o_o` |
| 😕 | `:confused:` | `:/` `:\` `:-/` `:-\` `=/` `=\` `:S` `:s` `:-S` `:-s` |
| 😐 | `:neutral_face:` | `:|` `:-|` `=|` |
| 😑 | `:expressionless:` | `-_-` |
| 😳 | `:flushed:` | `:$` `:-$` `o_O` `O_o` |
| 😵 | `:dizzy_face:` | `@_@` |
| 🤩 | `:star_struck:` | `*_*` |
| 🤐 | `:zipper_mouth_face:` | `:X` `:x` `:#` `:-X` `:-x` `:-#` |
| 😴 | `:sleeping:` | `|-)` |
| 💀 | `:skull:` | `x_x` `X_X` |

## Love / Kiss

| Emoji | Shortcode | Smileys |
| ----- | --------- | ------- |
| 😘 | `:kissing_heart:` | `:*` `:-*` `=*` |
| ❤️ | `:heart:` | `<3` |
| 💔 | `:broken_heart:` | `</3` |

## Animals / Other

| Emoji | Shortcode | Smileys |
| ----- | --------- | ------- |
| 😺 | `:smiley_cat:` | `:3` |

## Gestures

| Emoji | Shortcode | Smileys |
| ----- | --------- | ------- |
| 🙌 | `:raised_hands:` | `\o/` |

## Notes

- Smileys inside `` `inline code` `` and ` ``` code blocks ``` ` are **not** converted.
- `:/` and `:\` are skipped when they look like part of a URL (`http://`) or file path (`C:\`).
- Letter-starting smileys (`XD`, `B)`, `D:`, etc.) require a word boundary so they don't trigger inside words.
