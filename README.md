Bound & Free

A browser-based EMSA binding-curve workbench for extracting dissociation constants (Kd) from gel images.

Live: https://emsa-analyzer.com

What it does

Bound & Free quantifies protein–DNA binding directly from an electrophoretic mobility shift assay (EMSA) gel image, fits a binding curve, and reports the dissociation constant (Kd).

Method

Luminance is inverted so dark bands become positive signal. A smooth ALS (asymmetric least-squares) baseline is fit under each lane and subtracted before integrating band density. Fraction bound is computed within each lane as bound / (bound + free), which is physically bounded to [0, 1]. The binding curve is fit by Nelder–Mead minimization against log[protein], with the zero-protein control included in the fit. A bootstrap confidence interval reflects single-gel fit uncertainty — not replicate reproducibility.

Inputs

JPEG, PNG, or 16-bit TIFF. TIFFs are read at full bit depth for the cleanest faint-band quantification. Bands should appear dark on a light background.

Workflow


Upload a gel image
Rotate and crop, then place lanes and bands
Enter the protein concentration for each lane
Fit and read off Kd


Tabs

EMSA analysis — quantify a single gel and fit its binding curve (the workflow above).
Overlay — overlay multiple titrations on one normalised axis to compare Kd values. Use “Add to overlay” on the analysis tab, or drop exported CSVs.
Triplicate — combine replicate titrations of the same interaction. Each replicate is Hill-fit independently; the reported Kd is the geometric mean of the replicate fits with a 95% CI built across replicates (log space, t-distribution). When all replicates share a concentration grid, per-point mean ± SEM is shown; otherwise a Kd range is reported. %CV summarises run-to-run reproducibility. Use “Add to triplicate” on the analysis tab, or drop exported CSVs.


Develop and build

Requires Node 18+.

    npm install      # install dependencies
    npm run dev      # Vite dev server
    npm run build    # production build -> ./dist
    npm run preview  # serve the built ./dist locally

The app is entirely client-side (image processing, curve fitting and statistics all run
in the browser). Source is split into src/lib/emsa (logic: image IO, image processing,
curve fitting, CSV, stats) and src/components/emsa (React UI).


Deploy (Cloudflare Worker)

The build output in ./dist is served by a Worker (worker.js) via the static-assets
binding declared in wrangler.toml. Deploy as a Worker (Workers & Pages → Create → Workers
→ “Import a repository”), with build command `npm run build` and deploy command
`npx wrangler deploy`.


How to cite


Kuhlen, L. (2026). Bound & Free: a binding-curve workbench. https://emsa-analyzer.com



License

Released under the MIT License
