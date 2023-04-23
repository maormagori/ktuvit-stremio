# Ktuvit Stremio Addon
![GitHub Workflow Status](https://img.shields.io/github/actions/workflow/status/maormagori/ktuvit-stremio/render-deployment.yml?style=for-the-badge)
[!["Buy Me A Coffee"](https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png)](https://www.buymeacoffee.com/maormagori)


This is an unofficial [Stremio](http://strem.io/) addon for [ktuvit.me](https://ktuvit.me/), previously known as Screwzira.
It allows you to add Hebrew subtitles from Ktuvit to media streamed by Stremio. I have a similar addon for [Wizdom.xyz subtitles](https://github.com/maormagori/wizdom-stremio-v2) if you're interested.

**DISCLAIMER**: I am not affiliated with nor a part of Ktuvit.me. Any problems, issues, and attacks on the service or the content they provide should be addressed to them.

## Installation
The addon is available in the community addons section in Stremio. Search for "Ktuvit.me Subtitles" and press on install.

Alternatively, you can install the addon directly from here:
https://ktuvit-stremio.onrender.com/

## Development

Before trying to dive deep into the addon, get familiar with [Stremio's Addon Protocol](https://github.com/Stremio/stremio-addon-sdk/blob/master/docs/protocol.md). Otherwise, things wouldn't make much sense.

This addon is an [express](https://github.com/expressjs/express) server running on Node so make sure you're using the latest version of Node (Node 14 min) with NPM installed.

To get started, run these commands:
```bash
git clone https://github.com/maormagori/ktuvit-stremio.git
cd ktuvit-stremio
npm install
```

Before running the addon itself you'll have to set some environment variables so either export the required variables or create a `.env` file containing these variables:

```
KTUVIT_USER_EMAIL=your.ktuvit.user.email.address
KTUVIT_USER_HASHED_PASSWORD=your.ktuvit.user.hashed.password
```
Ktuvit hashes your password and uses it for authentication. This is required to make calls to Ktuvit.
If you're wondering what's your Ktuvit user's hashed password, CaTzil created a [guide](https://github.com/XBMCil/service.subtitles.ktuvit/blob/master/README.md) explaining how to get it.

After setting the variables you can run:
```bash
npm run start

# Alternatively with nodemon
npm run devStart
```

and the addon will be available on: `http://localhost:3000/`

#### Additional environment variables

You can also add these env variables to alter the way the addon behaves:
```bash
AUTHOR_EMAIL  # The email displayed in the addon's manifest
PORT   # The port the addon listens on. defaults to 3000
```
# Contributing
PRs are more than welcome!
Take a look at the currently open [issues](https://github.com/maormagori/ktuvit-stremio/issues) to see where you can help. If you're experiencing issues with the addon, be sure to open an issue.

This addon relies on a wrapper I wrote for Ktuvit which also needs some attention so if you can't find a way to help here, take a look at the [Ktuvit API repo](https://github.com/maormagori/Ktuvit-api).

# Supporting

Hey, if you're already here, consider starring this repository on Github 🌟

If you really want to show support, I have a [Buy Me Coffee](https://www.buymeacoffee.com/maormagori) page where you can drop a few shekels (Kidding, they only accept USD 😠).

And it's always a great ego booster to hear some positive feedback so just reach out.

# License
[MIT](https://github.com/maormagori/ktuvit-stremio/blob/main/LICENSE)