import xarray
import os
import sys

output = sys.argv[1]


# list to store all the xarrays
xarrays = []

# walk over 34vars/acc/*.nc and convert each to xarray, and append to the list
for root, dirs, files in os.walk("34Vars/acc"):
    for file in files:
        if file.endswith(".nc"):
            ds = xarray.open_dataset(root + "/" + file)
            ds = ds.drop_vars("initial_times")
            basename = os.path.basename(file)
            model, _ = os.path.splitext(basename)
            ds["model"] = model
            xarrays.append(ds)

# concatenate all the xarrays along the "model" dimension
combined = xarray.concat(xarrays, dim="model")

with open(output, "w") as index:
    df = combined.to_dataframe()
    df = df.reset_index()
    df.dropna(inplace=True)
    # convert pd.Timedelta into hours
    df["lead_time"] = df["lead_time"].dt.total_seconds() / 3600
    df.to_csv(output, index=False)

