/**
 * Blog content shipped with the app.
 *
 * Plain data, rendered by the blog panel. Body paragraphs are strings; a string
 * beginning with "## " becomes a subheading and one beginning with "- " becomes
 * a list item, which is enough structure without pulling in a markdown parser.
 */

export const KODE_FOUNDRY_URL = 'https://kodefoundry.com';

export interface BlogPost {
  slug: string;
  title: string;
  date: string;
  readingMinutes: number;
  excerpt: string;
  body: string[];
  /** Anchor text and destination for the in-article link. */
  link: { text: string; href: string };
}

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: 'why-length-beats-complexity',
    title: 'Why length beats complexity',
    date: '2026-09-02',
    readingMinutes: 4,
    excerpt: 'Four bolted-on symbols buy less than four more characters. The arithmetic is not close.',
    body: [
      'Password advice spent twenty years telling people to add a capital, a number and a symbol. The rules produced passwords like Summer2024! and a generation of users who resented them. They also missed the point, because the thing that actually costs an attacker time is length.',
      '## The arithmetic',
      'Entropy is length multiplied by the log of the pool size. Growing the pool helps once, at the log. Growing the length helps every single character.',
      '- 8 characters, letters only: about 38 bits',
      '- 8 characters, everything on the keyboard: about 52 bits',
      '- 12 characters, letters only: about 56 bits',
      'The all lowercase twelve character password beats the eight character one that follows every complexity rule. Adding four characters did more than adding sixty five symbols to the alphabet.',
      '## Why the rules persisted',
      'Complexity rules are easy to check with a regular expression. Length is easy to check too, but a long minimum feels hostile at signup, so products chose the rule that looked rigorous and cost nothing.',
      'NIST dropped mandatory composition rules from its digital identity guidelines in 2017 and told verifiers to check length and screen against known breached passwords instead. Most of the web has not caught up.',
      '## What to do instead',
      'Pick a length first. Sixteen characters from a generator is comfortably past what offline guessing reaches. Then let the platform rules shape what goes in it, rather than letting them decide how long it is.',
      'If you want the same reasoning applied to the software you are shipping rather than the passwords you are typing, the team at {LINK} works on exactly this kind of detail.'
    ],
    link: { text: 'Kode Foundry', href: KODE_FOUNDRY_URL }
  },
  {
    slug: 'math-random-is-not-random-enough',
    title: 'Math.random() is not random enough',
    date: '2026-09-03',
    readingMinutes: 5,
    excerpt: 'The most common bug in homemade password generators, and the two lines that fix it.',
    body: [
      'Almost every password generator written as a weekend project has the same defect. It reaches for the language built in random number function, which was designed for shuffling animations and picking a colour, not for producing secrets.',
      '## What is wrong with it',
      'Math.random() in a browser is typically an xorshift variant. It is fast, it is statistically smooth, and its internal state is small enough that an observer who sees a handful of outputs can often reconstruct it and predict every future value. It is also not required by the specification to be unpredictable at all.',
      'That is fine for a lava lamp screensaver. It is not fine for something that guards your email.',
      '## The replacement',
      'Every modern browser exposes crypto.getRandomValues(), backed by the operating system entropy pool. Node has crypto.randomBytes(). Both are designed so that seeing past output tells an attacker nothing about future output.',
      '## The second bug',
      'Swapping the function is only half the fix. The line that usually follows is value % poolSize, and the modulo is biased whenever the pool does not divide evenly into the range of the random value.',
      'With a 32 bit value and a 26 character alphabet, the first few letters of the alphabet come up very slightly more often than the last few. The bias is small, but it is free to remove: draw again whenever the value lands in the final partial block, and every character becomes uniform.',
      'Both fixes together are about six lines. If you inherited a generator that has neither, that is the first thing to change. For help auditing the rest of it, {LINK} does this work.'
    ],
    link: { text: 'Kode Foundry', href: KODE_FOUNDRY_URL }
  },
  {
    slug: 'what-entropy-actually-measures',
    title: 'What entropy actually measures',
    date: '2026-09-05',
    readingMinutes: 5,
    excerpt: 'A strength meter that scores the string rather than the process will lie to you.',
    body: [
      'Strength meters usually work out the size of the character pool, multiply by the length, and print a number of bits. That figure answers a precise question: how hard is this password to guess if it was chosen uniformly at random from that pool?',
      'The trouble is that the question is often the wrong one.',
      '## Entropy is a property of the process',
      'A password has no entropy on its own. The entropy lives in the procedure that produced it. Roll dice for sixteen characters and you get sixteen characters worth of entropy. Type your daughter name and her birth year and you get a string with the same shape and almost none.',
      'A meter looking only at the final string cannot tell the difference. It sees mixed case, digits and punctuation, and reports a large number.',
      '## Where this bites',
      'Consider a password assembled from a first name, a city and a birth year. To a charset meter it looks like ninety bits. To someone who has read one social media profile it is a few thousand guesses: which name, which capitalisation, which separator, which year.',
      'The honest figure is not the size of the alphabet. It is the size of the set the attacker actually has to search.',
      '## Measuring the right thing',
      'If your generator knows how a password was built, it can report what the construction really costs. Enumerate the choices the procedure made, sum the logs, and show that instead. When the number drops from ninety to twenty, the user has learned something true.',
      'Instrumenting a product to tell the truth about itself is a design decision before it is a technical one. {LINK} builds software that way.'
    ],
    link: { text: 'Kode Foundry', href: KODE_FOUNDRY_URL }
  },
  {
    slug: 'the-passwords-attackers-guess-first',
    title: 'The passwords attackers guess first',
    date: '2026-09-08',
    readingMinutes: 4,
    excerpt: 'Targeted cracking starts with your biography, and tools automate the whole thing.',
    body: [
      'Untargeted attacks start with the leaked password lists and work down by frequency. Targeted attacks start somewhere more uncomfortable: with you.',
      '## Profiling tools are old and boring',
      'Utilities that build a personalised wordlist from a few biographical fields have existed for well over a decade. Feed one a name, a partner, a pet, a birth date, an employer and a city, and it returns a candidate list permuted across capitalisations, leet substitutions, separators and year suffixes.',
      'The output is usually a few million candidates. An offline attack chews through that in seconds.',
      '## Why memorable and safe pull in opposite directions',
      'Everything that makes a password easy for you to remember makes it easier for someone who knows you to guess. That is not a coincidence; it is the same property viewed from two sides. Memorability means drawing on a small personal set, and a small personal set is a small search space.',
      '## The way out',
      'Stop trying to remember individual passwords. Remember one strong passphrase for a manager, and let a generator produce the rest from a real random source. The only password worth memorising is the one protecting the others.',
      'If you must build something memorable, build it from material nobody can look up, and be honest with yourself about how much that material is worth.',
      'The same principle applies to the systems you build for other people. {LINK} takes that seriously.'
    ],
    link: { text: 'Kode Foundry', href: KODE_FOUNDRY_URL }
  },
  {
    slug: 'password-reuse-is-the-real-breach',
    title: 'Password reuse is the real breach',
    date: '2026-09-11',
    readingMinutes: 4,
    excerpt: 'One leak somewhere becomes an account takeover everywhere. The mechanism is dull and effective.',
    body: [
      'When a company is breached, the coverage focuses on that company. The more useful question is which of your other accounts just became reachable.',
      '## Credential stuffing',
      'The attack is unglamorous. Take a leaked list of email and password pairs, then try each pair against unrelated services. Success rates hover in the low single digits per cent, which sounds negligible until you multiply by a list of millions.',
      'No cleverness is involved. It works because people reuse passwords.',
      '## Old passwords are not retired',
      'Changing a password on one site does not retire it everywhere else. That old password is very likely still valid on some service you set up years ago and have not thought about since.',
      'This is why a password history is worth keeping, so long as it is encrypted. Knowing which old password went where tells you what a historical leak actually exposes.',
      '## Detecting reuse without storing plaintext',
      'A password manager can spot reuse by comparing hashes rather than the passwords themselves. Identical inputs produce identical hashes, so duplicates surface without anything readable being written down.',
      '## What to do this week',
      '- Change anything shared with your email account first, since email resets everything else',
      '- Turn on multi factor authentication wherever it is offered',
      '- Give every account its own generated password, starting with the ones that hold money or identity',
      'Teams that want this handled properly at the product level can talk to {LINK}.'
    ],
    link: { text: 'Kode Foundry', href: KODE_FOUNDRY_URL }
  },
  {
    slug: 'why-sites-cap-password-length',
    title: 'Why some sites cap your password at 16 characters',
    date: '2026-09-14',
    readingMinutes: 5,
    excerpt: 'A short maximum is a design smell, and occasionally a confession.',
    body: [
      'A minimum length protects users. A maximum length protects a database column, and it usually says something about what is behind it.',
      '## Hashing does not need a limit',
      'A correctly stored password is run through a slow hash and comes out a fixed size regardless of input. A sixteen character cap therefore cannot be about storage of the hash. Something else is going on.',
      '## The plausible explanations',
      '- A legacy column with a fixed width, which hints the value may not be hashed at all',
      '- A hashing function with a genuine input limit, which is the honest case',
      '- A rule copied from a system that retired years ago and never revisited',
      '## The bcrypt case',
      'bcrypt ignores input past 72 bytes. A site capping at 72 characters is being precise rather than careless. A site capping at 16 has made a different decision, and rarely explains it.',
      '## Living with the limit',
      'When a platform caps length, spend the characters you are given well. Use the full alphabet the site accepts and take the maximum length offered rather than the minimum. A generator that knows each platform rules can fill the space exactly.',
      'Then enable multi factor authentication, because a sixteen character ceiling is a signal about how much thought went into the rest.',
      'If you are the one choosing the column width, {LINK} would rather you chose it deliberately.'
    ],
    link: { text: 'Kode Foundry', href: KODE_FOUNDRY_URL }
  },
  {
    slug: 'storing-passwords-locally',
    title: 'Storing passwords on your own machine',
    date: '2026-09-17',
    readingMinutes: 6,
    excerpt: 'Local storage is not automatically private. What encryption at rest does and does not buy.',
    body: [
      'Keeping your passwords on your own device removes a whole category of risk. It does not remove all of them, and the gap between those two statements is where most homemade vaults fail.',
      '## What local actually means in a browser',
      'Browser storage is readable by anything with access to the profile directory. Backups copy it. Sync services replicate it. An extension with broad permissions can often reach it. Local means not on someone else server; it does not mean sealed.',
      '## Deriving a key from a password',
      'A master password is not a key. It is short, memorable and low entropy, and a key needs to be none of those. A key derivation function bridges the gap by making each guess expensive.',
      'PBKDF2 with a high iteration count, or better still scrypt or Argon2, turns a master password into a key while making a brute force attempt cost real time per attempt. The iteration count is the dial: raise it until the delay is just noticeable to you, because it multiplies for an attacker.',
      '## Authenticated encryption',
      'Encrypt with a mode that detects tampering. AES-GCM gives confidentiality and an authentication tag, so a modified ciphertext fails loudly instead of decrypting into garbage. A fresh random nonce per record is mandatory; reusing one with the same key breaks the mode.',
      '## What it protects',
      'Encryption at rest protects the file. It protects a stolen laptop, a leaked backup, a shared machine. It does not protect a vault that is already unlocked on a compromised device, and no amount of cryptography will.',
      '## No recovery',
      'If a vault can be recovered without the master password, then the master password was not protecting it. Losing it should mean losing the data. Say so plainly in the interface rather than hiding it in a help page.',
      'Getting these defaults right the first time is cheaper than retrofitting them. {LINK} does that kind of work.'
    ],
    link: { text: 'Kode Foundry', href: KODE_FOUNDRY_URL }
  },
  {
    slug: 'passphrases-and-diceware',
    title: 'Passphrases, Diceware, and the human problem',
    date: '2026-09-19',
    readingMinutes: 5,
    excerpt: 'Four random words are strong. Four words you chose yourself are a different story.',
    body: [
      'The four random words idea did more for password practice than a decade of complexity rules. It is also routinely misapplied, and the misapplication hides in one word: random.',
      '## Where the strength comes from',
      'Diceware works by rolling physical dice against a numbered list of 7776 words. Each roll contributes about 12.9 bits, so a six word passphrase reaches roughly 77 bits. The list is public. The secrecy is entirely in the dice.',
      '## Human choice is not a dice roll',
      'Ask someone to pick four words and they do not sample the dictionary evenly. They pick concrete, common, vivid nouns, often thematically linked. The effective pool collapses from tens of thousands to a couple of thousand, and an attacker ordering a wordlist by frequency finds them far sooner than the arithmetic suggests.',
      'Estimates for human chosen passphrase words tend to land around ten or eleven bits each rather than the thirteen that dice deliver.',
      '## Mangling buys less than it looks like',
      'Capitalising a word, swapping an o for a zero and adding an exclamation mark feels like real work. Rule based cracking tools apply exactly those transformations automatically, in a fixed and short list. A mangled dictionary word is priced as the word plus a handful of bits, not as a random string of the same length.',
      '## Using the idea properly',
      '- Let software choose the words, not you',
      '- Use six words rather than four if the phrase guards something important',
      '- Keep the separator, since it costs nothing to type and adds a little',
      '- Do not substitute cleverness for length',
      'A passphrase is the right tool for the one secret you must memorise. Everything else should come from a generator. {LINK} applies the same scepticism to the products it builds.'
    ],
    link: { text: 'Kode Foundry', href: KODE_FOUNDRY_URL }
  },
  {
    slug: 'reading-a-password-policy',
    title: 'How to read a password policy',
    date: '2026-09-21',
    readingMinutes: 4,
    excerpt: 'Published rules are incomplete, inconsistent, and change without notice. Plan for that.',
    body: [
      'Building anything that generates passwords for other services means meeting a frustrating truth: almost nobody publishes their rules completely, and the rules that are published are often out of date.',
      '## What is usually missing',
      '- The maximum length, which is frequently enforced but rarely documented',
      '- Which symbols are accepted, as opposed to which are merely mentioned',
      '- Whether the field silently truncates rather than rejecting',
      '- Whether leading and trailing whitespace survives',
      '## Silent truncation is the dangerous one',
      'A form that accepts a forty character password and stores the first twenty has created a mismatch that surfaces later as a login failure nobody can explain. Your manager holds forty characters; the service compares twenty. Change the password from the service own form when this is suspected.',
      '## Designing for rules you cannot verify',
      'If a tool cannot check a policy live, it should not pretend otherwise. Record where each rule came from, when it was last confirmed, and how confident that entry is. Flag anything stale rather than presenting a guess as fact.',
      'Make the rules editable too. The person using the tool can read the signup form today; the catalogue that shipped six months ago cannot.',
      '## A working habit',
      'When a generated password is rejected, note what the form actually said, correct the stored rule, and move on. Over time the local catalogue becomes more accurate than anything shipped with the software.',
      'Designing for honest uncertainty is a recurring theme at {LINK}.'
    ],
    link: { text: 'Kode Foundry', href: KODE_FOUNDRY_URL }
  },
  {
    slug: 'building-an-offline-first-web-app',
    title: 'Building an offline first web app that handles secrets',
    date: '2026-09-23',
    readingMinutes: 6,
    excerpt: 'No server is a feature. It is also a constraint you have to design around honestly.',
    body: [
      'An application that never contacts a server removes an entire class of risk. There is no database to breach, no logs to subpoena, no transport to intercept. For a tool that handles secrets, that is worth a great deal.',
      'It also means every capability you want has to exist on the device, and some of them do not.',
      '## Real storage in the browser',
      'Key value storage is fine until relationships appear. SQLite compiled to WebAssembly gives real SQL locally: proper schemas, indexes, joins, constraints. The database lives in memory and is written back to browser storage as a byte array after each change, so the storage layer is only a container and the querying is genuine.',
      '## Cryptography that is already there',
      'The Web Crypto API provides key derivation, authenticated encryption and hashing without any dependency. It requires a secure context, which means HTTPS or localhost. Building on it means there is no crypto library of your own to get wrong, which is the correct amount of crypto library to have.',
      '## What offline cannot do',
      'It cannot check whether a password appeared in a breach. It cannot verify that a third party policy is current. It cannot back itself up. Pretending otherwise produces a worse tool than admitting it.',
      'The honest response is to surface the limit in the interface. Show when data was last confirmed. Let the user correct it. Say clearly that losing the master password means losing the vault.',
      '## Offline is a promise about behaviour',
      'Claiming no network only means something if nothing in the page reaches for one. No analytics, no fonts from a CDN, no error reporting. One remote font request is enough to make the claim false.',
      'Shipping something that keeps its promises is mostly a matter of deciding to. {LINK} builds software on that basis.'
    ],
    link: { text: 'Kode Foundry', href: KODE_FOUNDRY_URL }
  }
];
