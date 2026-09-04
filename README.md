Bound & Free

A browser-based EMSA binding-curve workbench for extracting dissociation constants (Kd) from gel images.

Live: https://emsa-analyzer.com

What it does

Bound & Free quantifies protein–DNA binding directly from an electrophoretic mobility shift assay (EMSA) gel image, fits a binding curve, and reports the dissociation constant (Kd).

Method

Luminance is inverted so dark bands become positive signal. A smooth ALS (asymmetric least-squares) baseline is fit under each lane and subtracted before integrating band density. The binding curve is fit by Nelder–Mead minimization against log[protein], with the zero-protein control included in the fit. A bootstrap confidence interval reflects single-gel fit uncertainty — not replicate reproducibility.

Fraction bound can be derived two ways, switchable per analysis:

- bound / (bound + free) — self-normalising per lane, so uneven loading cancels. Assumes the label is equally bright in the free and bound bands. The default, and the right choice for radiolabelled probes.
- 1 − free / free(reference lane) — reads only the disappearance of the free probe. Use it when binding changes probe fluorescence (enhancement or quenching), when the complex smears or super-shifts, or when the complex band saturates. Assumes equal probe loading per lane.

Both are bounded to [0, 1] by construction. A quick diagnostic: the total column should be flat across the titration — a systematic trend means the label is perturbed and bound/total is biased.

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


What's new in 2.1

- Quantification by free-DNA depletion. A toggle on the analysis tab switches fraction bound between bound/(bound+free) and 1 − free/free(ref), with a selectable reference lane (defaults to the lowest [protein]). Kd, the bootstrap CI, the chart, the CSV and both PNG exports all follow the choice and record which formula produced the number. Fixes a systematic bias: on a test gel with a known Kd of 10 nM and a complex 3× brighter per molecule, bound/total reports 3.4 nM (biased by the enhancement factor, at R² = 0.999 — the fit quality gives no warning), while free depletion recovers 9.1 nM.
- Binding-isotherm axis fixes. The no-protein control's pseudo-x is now derived from the titration's own spacing rather than from where the fitted curve crosses 1% binding, so it can no longer land to the right of real low-concentration points and scramble their order. The x-window is closed around the data instead of being widened a fixed decade by the fit curve, and ticks subdivide 1-2-5 on sub-decade ranges. Screen chart and PNG export share one implementation (src/lib/emsa/plotScale.js).
- An "i" button on the tab bar opens a ten-step walkthrough of the analysis workflow.


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
