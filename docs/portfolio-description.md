# PassGen

## Short version

A password generator that measures the process instead of the string. Most strength
meters count the characters in front of them and report a big number. PassGen reports
what the password actually costs someone trying to break it, and shows the arithmetic.

## What it is

PassGen generates passwords, checks them against the real rules of 27 platforms, and
stores them in an encrypted local vault. It runs entirely in the browser. No account,
no server, no network requests of any kind.

The reason it exists is a gap most password tools ignore. A meter that sees mixed
case, digits and punctuation will happily report 98 bits for a password built out of
your name and your birth year. To anyone who has read one social media profile, that
password is a few thousand guesses. The number isn't wrong so much as it's answering
the wrong question.

## How it works

**Generation.** Characters come from `crypto.getRandomValues`, never `Math.random()`.
Values landing in the final partial block get discarded and redrawn, because taking
`random % poolSize` is biased whenever the pool doesn't divide evenly into 2^32. A
Fisher-Yates shuffle then scatters the guaranteed characters so they aren't sitting in
fixed positions.

**Platform rules.** A catalogue of 27 services carries the constraints each one
actually enforces: length floors and ceilings, required character classes, restricted
symbol sets, limits on repeated characters. Pick GitHub and the minimum jumps to 15.
Pick PayPal and it caps at 20 and narrows the symbol set. Since the app has no network
and can't verify any of this live, every entry carries a confidence rating, the date it
was last checked, and a link to the platform's own page. Anything older than 180 days
gets flagged for review, and you can correct any field yourself. Your edits survive
updates to the built-in list.

**Memorable passwords, priced honestly.** You can give the app five to ten private
words and let it build passwords from those. Each word is scored the way a rule-based
cracker would score it, not on raw character count. A plain lowercase word is capped at
the strength of a frequency-ordered wordlist however long it is, because `encyclopedia`
is one entry in a list rather than 56 bits of guessing. Mixing in case, digits or
symbols prices it on its characters instead.

**Two numbers, both shown.** Because those words get reused across every password the
list produces, the list behaves like a key. So the app reports what a password costs
while the list stays secret, and what's left if the list ever leaks. A typical result
is 62 bits in the first case and 24 in the second, with the full breakdown under each
one. That second figure is why the word list gets encrypted alongside the passwords.

**Storage.** Real SQLite, compiled to WebAssembly and running in the page. The database
lives in memory and gets written back to IndexedDB after each change, so IndexedDB is
just a container and the querying is genuine SQL. Passwords are encrypted with AES-GCM
256 under a key stretched from a master password by PBKDF2-HMAC-SHA256 at 310,000
iterations. The database holds ciphertext and nothing else. Reuse across platforms is
caught by comparing unsalted hashes, which surfaces duplicates without writing anything
readable to disk.

There's no recovery path. A vault you can open without the master password wasn't being
protected by it.

**Interface.** Six panels behind a hairline tab bar: generate, vault, words, profile,
specs and a blog. Each character in the readout is tinted by class, which makes a long
password readable when you have to type it by hand. Those accent colours were checked
for colour-vision-deficiency separation against their own surface in both themes, and
every class is labelled in text as well, so nothing depends on colour alone. Light
theme by default, with a dark palette that was chosen separately rather than inverted.

## What I'd flag

It hasn't been through a third-party security audit. The per-word entropy figures
assume a 2048-word effective vocabulary for human-chosen words, which sits at the
conservative end of published estimates, so the number it gives you is closer to a
floor than a promise. And the platform specs are best-effort: several are marked medium
or low confidence, and the app says so rather than presenting a guess as fact.

## Tech stack

Angular 8, Ionic 5, TypeScript, SQLite (sql.js / WebAssembly), IndexedDB, Web Crypto API (AES-GCM, PBKDF2), SCSS, RxJS, Karma, Jasmine, Playwright
