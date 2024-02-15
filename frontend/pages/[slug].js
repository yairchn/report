import { useState, useEffect } from 'react';
// workaround to avoid "self" not found error
// see https://github.com/plotly/react-plotly.js/issues/272#issuecomment-1328283528
import dynamic from "next/dynamic";
const Plot = dynamic(() => import("react-plotly.js"), { ssr: false, })
const Plotly = dynamic(() => import("plotly.js"), { ssr: false, })
import * as d3 from 'd3';
import fs from 'fs';
import { VegaLite } from 'react-vega'

import { Autocomplete, FormControl, RadioGroup, FormControlLabel, FormLabel, Radio, Stack, Box, Grid, TextField, Typography } from '@mui/material';


function getUniqueModels(rows) {
    var models = Array.from(new Set(rows.map(obj => obj.model)));
    models.sort();
    return models;
}


function ModelSelector({ models, selectedModels, onSelectModels }) {
    return (
        <div style={{ marginBottom: 50, width: '100%' }}>
            <Autocomplete
                multiple
                disableCloseOnSelect
                sx={{ width: 800 }}
                value={selectedModels}
                options={models}
                onChange={(event, newValue) => { onSelectModels(newValue) }}
                renderInput={(params) => (
                    <TextField {...params} label="Models to select" variant="standard" />
                )}
            />
        </div>
    );
}


function Vega({ rows, baseline, skillScore }) {
    // return a vega-lite plot

    const channels = [
        "z850",
        "t850",
        "r850",
        "z500",
        "t500",
        "r500",
        "z200",
        "t200",
        "r200",
        "tcwv",
        "t2m",
        "u10m",
        "v10m",
    ];
    var leadTimes = [0.25, 3, 7, 14];

    // compute map of baseline skill
    // baselineSkill[lead_time][channel] = skill
    var baselineSkill = {};
    rows.forEach(function (row) {
        if (!(row.lead_time in baselineSkill)) {
            baselineSkill[row.lead_time] = {};
        }

        if (row.model == baseline) {
            baselineSkill[row.lead_time][row.channel] = row[skillScore];
        }
    });

    // compute skill relative to baseline
    // convert lead_time to int
    rows = rows.map(row => {
        var score = row[skillScore] / baselineSkill[row.lead_time][row.channel];
        score -= 1;
        return { ...row, score: score };
    });


    rows = rows.map(row => { return { ...row, lead_time: row.lead_time / 24 } });

    rows = rows.filter(row => {
        return channels.includes(row.channel) && leadTimes.includes(row.lead_time)
    });


    const scale = {
        domainMid: 0.0,
        domainMax: 0.5,
        domainMin: -0.5,
        type: "linear",
        interpolate: "rgb",
        range: ["#76b900", "#ffffff", "#0072CE"]
    };


    const spec = {
        // width: 400,
        // height: 200,
        mark: 'rect',
        encoding: {
            y: { field: 'lead_time', type: "ordinal", title: "days" },
            x: { field: 'model', type: 'nominal' },
            color: { field: 'score', type: 'quantitative', scale: scale },
            row: { field: 'channel', type: 'nominal' },
            order: { field: "lead_time" },
            tooltip: { field: 'score', type: 'quantitative', format: '.2f' }
        },
        config: {
            axis: {
                labelFontSize: 14,
                titleFontSize: 14,
                tickLabelFontSize: 14
            }
            , header: {
                labelFontSize: 14,
                labelAngle: 0,
                titleFontSize: 16
            }
            , facet: { spacing: 0 }
            , legend: {
                titleFontSize: 14,
                labelFontSize: 12,
                symbolSize: 200,  // adjust the size of the color swatches
                tickCount: 5,  // adjust the number of ticks on the colorbar
                gradientLength: 200,  // adjust the length of the colorbar
                gradientThickness: 20,  // adjust the thickness of the colorbar
                orient: "right"  // adjust the orientation of the colorbar
            }
        },
        data: { name: 'table' }, // note: vega-lite data attribute is a plain object instead of an array
    }
    return <VegaLite spec={spec} data={{ table: rows }} />

}

function ScoreCardSelectField({ fields, field, onChange }) {
    const labels = fields.map(field => (<FormControlLabel key={field} value={field} control={<Radio />} label={field} />));

    return (
        <FormControl>
            <FormLabel id="demo-radio-buttons-group-label">Skill Score</FormLabel>
            <RadioGroup
                aria-labelledby="demo-radio-buttons-group-label"
                value={field}
                name="radio-buttons-group"
                row
                onChange={(event, value) => onChange(value)}
            >
                {labels}
            </RadioGroup>
        </FormControl>
    );
}

function ScoreCard({ rows, skillScores }) {
    var [baseline, setBaseline] = useState("pangu_6");
    var models = getUniqueModels(rows);
    var [skillScore, setSkillScore] = useState(skillScores[0]);

    return (
        <Stack>
            <Typography variant="h2">Scorecard</Typography>
            <ScoreCardSelectField field={skillScore} fields={skillScores} onChange={setSkillScore} />
            <Autocomplete
                sx={{ width: 200 }}
                options={models}
                value={baseline}
                onChange={(event, newValue) => { setBaseline(newValue) }}
                renderInput={(params) => (
                    <TextField {...params} label="Baseline" variant="standard" />
                )}
            />
            <Vega rows={rows} baseline={baseline} skillScore={skillScore} />
        </Stack>
    )
}

// a colorblind friendly palette
const wong_palette = [
    "#000000",
    "#E69F00",
    "#56B4E9",
    "#009E73",
    "#F0E442",
    "#0072B2",
    "#D55E00",
    "#CC79A7"
];


function PlotField({ field, channel, rows, width }) {
    // Filter data by channel
    var data = [];
    rows = rows.filter(function (row) {
        return (row.channel === channel);
    });


    // Define trace for each model
    var traces = {};
    rows.forEach(function (row) {
        if (!(row.model in traces)) {
            const traceNum = Object.keys(traces).length;
            traces[row.model] = {
                x: [],
                y: [],
                name: row.model,
                mode: 'lines',
                line: {color: wong_palette[traceNum % wong_palette.length]}
            };
        }
        traces[row.model].x.push(row.lead_time);
        traces[row.model].y.push(row[field]);
    });

    // Convert traces to an array
    for (var model in traces) {
        data.push(traces[model]);
    }
    const layout = {
        width: width,
        height: width / 1.61,
        xaxis: {
            title: 'Lead Time (h)'
        },
        yaxis: {
            title: field + " of " + channel
        },
        hovermode: 'x unified',
        dragmode: 'zoom'
    };
    return <Plot data={data} layout={layout} />
}


function FixedLeadTimePlot({ field, channel, leadTime, rows, width }) {
    // Filter data by channel
    var data = [];
    // Define trace for each model
    rows = rows.filter(function (row) {
        return (row.channel === channel) && (row.lead_time == leadTime);
    });
    // sort ascending
    rows.sort((a, b) => (b[field] - a[field]))


    var traces = {
        // y: rows.map(row => row.model),
        x: rows.map(row => row[field]),
        text: rows.map(row => row.model),
        type: 'bar',
        orientation: 'h',
    };

    const layout = {
        width: width,
        height: width / 1.61,
        xaxis: {
            title: 'Model'
        },
        yaxis: {
            title: field + " of " + channel
        },
        // hovermode: 'x unified',
        dragmode: 'zoom'
    };
    data.push(traces);
    return <Plot data={data} layout={layout} />
}

function getScoreNames(row) {
    var scoresSet = new Set(Object.keys(row));
    scoresSet.delete("lead_time");
    scoresSet.delete("model");
    scoresSet.delete("channel");
    return Array.from(scoresSet);
}

function App(props) {
    const { fileContent } = props;

    var channels = Array.from(new Set(fileContent.map(obj => obj.channel)));
    channels.sort();

    const defaultModels = getUniqueModels(fileContent);

    const [rows, setRows] = useState(fileContent);
    const [channel, setChannel] = useState("z500");
    const [models, setModels] = useState(getUniqueModels(fileContent));


    function onSelectModels(modelNames) {
        var filteredRows = fileContent.filter(row => modelNames.includes(row.model));
        setRows(filteredRows);
        setModels(modelNames);
    }

    const scores = getScoreNames(fileContent[0]);

    const leadTimePlots = scores.map(score => (
        <Box key={score}>
            <Typography variant="h5">{score.toUpperCase()}</Typography>
            <PlotField field={score} rows={rows} channel={channel} width={800} />
        </Box>))

    return (
        <div style={{
            width: "80%", margin: "auto", minWidth: "800px", backgroundColor: "#F5F5F5",
            padding: "2em", borderRadius: "1em"
        }}>
            <ModelSelector models={defaultModels} selectedModels={models} onSelectModels={onSelectModels} />
            <ScoreCard skillScores={scores} rows={rows} />
            <Stack spacing={3} sx={{ marginTop: "2em" }}>
                <Typography variant="h4" >Lead-time series</Typography>
                <Autocomplete
                    options={channels}
                    value={channel}
                    onChange={(event, newValue) => { setChannel(newValue) }}
                    renderInput={(params) => (
                        <TextField {...params} label="Channel" variant="outlined" />
                    )}
                />
                {leadTimePlots}
                <Box>
                    <Typography variant="h5">RMSE at 6 hours</Typography>
                    <FixedLeadTimePlot field="rmse" rows={rows} leadTime={'6.0'} channel={channel} width={1200} />
                    <Typography>This is the lead time at which most FCN training is done, so most directly tracks improvements in ML architecture and problem formulation.</Typography>
                </Box>
            </Stack>
        </div>

    )
}

export default App;

export async function getStaticPaths() {
    return {
        paths: [
            { params: { slug: 'medium-range' } },
            { params: { slug: 'lagged-ensemble' } },
        ],
        fallback: false
    }
}

export async function getStaticProps({ params }) {
    const arr = d3.csvParse(fs.readFileSync('public/' + params.slug + '.csv', 'utf-8'))

    // read json lines from data.json
    return { props: { fileContent: arr } };
}
