# The dashboard

The fcn-mip dashboard is hosted here:
https://earth-2.gitlab-master-pages.nvidia.com/fcn-mip/, and has sub-pages for
deterministic and lagged ensemble scoring.

## Adding a model to the dashboard


Models are added to the dashbord by making an MR with the output data of various
scoring scripts. Once the MR is merged to main, the dashboard will be updated to
include these new data.

### Deterministic ACC

Score the model with this command (for example)
```
torchrun --nproc_per_node 8 -m earth2mip.inference_medium_range -n 56 <model> <model>.nc
```
You may need to change this command to integrate with your cluster environment.

Then, make an MR to fcn-mip, adding the `34Vars/acc/<model>.nc` file. Make sure
you `git lfs install` before adding this nc file.

Once this MR is merged, the model will appear on the dashboard.

### Lagged Ensemble

Score the model with this command (for example):
```
myscores=some/path
model="your model"
# You may need to change this command to integrate with your cluster environment.
torchrun --nproc_per_node 8 -m earth2mip.lagged_ensembles --lags 4 --inits 664 --leads 23 --model $model --output $myscores/$model
# will make files $myscores/$model.000.csv, one file per rank of the scoring

# take a lead time average of all the csvs in $myscores
python bin/average_lagged_ensemble_csvs.py $myscores 34Vars/lagged_ensemble/
```

Then, check-in the contents of 34Vars/lagged_ensemble
```
git add 34Vars/lagged_ensemble
git commit -m "add lagged-ensemble scores of $model"
```
and open an MR.

Once merged, this will appear: https://earth-2.gitlab-master-pages.nvidia.com/fcn-mip/lagged-ensemble

## Viewing/developing the dashboard locally

If you want to quickly view the dashboard to see model performance before
scoring, you first need to install [node.js](https://nodejs.org/en), and then
the dashboard js dependencies
```
cd frontend/dashboard
npm install
```

Then from the project root run
```
make serve
```

This will open a development dashboard at http://localhost:3000/fcn-mip/index.html, by
default. If the 3000 port is already in use, then you may need to update the URL
accordingly.

## Dashboard Architecture

The dashboard is a static Next.js app hosted in Gitlab pages. It reads in scoring data that is
checked-in to this repo, typically using git-lfs. The web page is updated by [Gitlab
CI](/.gitlab-ci.yml). On every update to the main branch, the contents of
34Vars/acc/ and 34Vars/lagged_ensembles/ are converted to a flat csv file in
[frontend/public/](/frontend/public). Then next.js is used to build a static
website with these data as input. This process is orchestrated by the
root-level [Makefile](./Makefile).

The tradeoff of this design is that "adding a model" is a manual process, but in
return we do not need to host any custom infrastructure like a server or cron
job to update the dashboard. This represents a maintanable midpoint between no
automation (e.g. sharing pngs of scores on slack) and full automation (e.g.
hosting score data in a database-backed webapp). The MR process also provides
teammates an opportunity to discuss the model being scored, and can serve as a
future record of the model.

The javascript portion of the dashboard is written [here](./pages/[slug].js). It
takes `.csv` data in [public/](./public/) and turns it into a dashboard. The csv data has the following schema:
```
lead_time,channel,crps,model,rmse_mean,rmse_det
-48.0,u10m,0.6147333569730716,ifs,0.8822532678872949,
```

`lead_time` is in hours. The dashboard requires `lead_time`, `channel`, `model`
columns. All other columns are assumed to be the names of `metrics`, and will
all be automatically displayed in the dashboard. Therefore, the .csv file can
accomodate metrics with arbitrary names and values.