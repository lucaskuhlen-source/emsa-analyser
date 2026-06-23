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


How to cite


Kuhlen, L. (2026). Bound & Free: a binding-curve workbench. https://emsa-analyzer.com



License

Released under the MIT License
