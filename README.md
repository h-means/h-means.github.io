# h-means.github.io

Source of the h-means site: https://h-means.github.io/

The method, code, logged runs and paper live in the [hmeans](https://github.com/heldernoid/hmeans) repository. This repository holds the Astro site that documents them, with the browser simulations and the playground.

## Development

```
npm install
npm run dev        # http://localhost:4321
npm run build      # static output in dist/, paths made relative
npm run sync       # refresh the PDF and results.json from a sibling hmeans checkout
npm run gif        # re-record public/assets/demo.gif from the running dev server
```

The GitHub Actions workflow builds and deploys `dist/` on every push to main (Settings, Pages, Source: GitHub Actions).

## Layout

| path | what |
|---|---|
| `src/pages/` | the four pages: overview (the article), results, playground, reproduce |
| `src/data/results.json` | every number on the site, exported from the logged runs of the hmeans repository |
| `public/assets/core.js` | Lloyd, e-means and h-means in two dimensions, JavaScript port used by the simulations and the playground |
| `public/assets/sims.js`, `charts.js` | the front-page simulations and the SVG charts |
| `public/assets/hmeans.pdf` | the technical note, copied from the paper by `npm run sync` |

## License

MIT. The 2-D generators and the Lloyd and e-means trainers in `core.js` are adapted from the [e-means playground](https://github.com/e-means/e-means.github.io) (Meta Platforms, MIT).
