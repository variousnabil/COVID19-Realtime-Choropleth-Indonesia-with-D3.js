const urlCOVID = 'https://indonesia-covid-19-api.now.sh/api/provinsi';
const urltopoIDN = 'https://raw.githubusercontent.com/ghapsara/indonesia-atlas/master/provinsi/provinces-simplified-topo.json';

const w = 1600;
const h = 600;

const margin = {
    top: 36,
    right: 32,
    bottom: 36,
    left: 32
}

const getCOVID = axios.get(urlCOVID);
const gettopoIDN = axios.get(urltopoIDN);

Promise.all([getCOVID, gettopoIDN])
    .then(results => {

        const projection = d3.geoMercator()
            .center([118.25, - 5])
            .scale(w * 1.2)
            .translate([w / 2 - 200, h / 2]);
        const path = d3.geoPath(projection);

        const SVG_HEADER = d3.select('.container')
            .append('svg')
            .attr('id', 'SVGHEADER')
            .attr('viewBox', [0, 0, w, 80]);

        const SVG_IDN_MAP = d3.select('.container')
            .append('svg')
            .attr('id', 'SVGMAP')
            .attr('viewBox', [-200, -80, 1550, 595]);

        const SVG_FOOTER = d3.select('.container')
            .append('svg')
            .attr('id', 'SVGFOOTER')
            .attr('viewBox', [0, 0, 1550, 30]);

        SVG_HEADER.append('text')
            .attr('x', w / 2)
            .attr('y', margin.top - 9)
            .attr('text-anchor', 'middle')
            .attr('id', 'title')
            .style('font-size', '1.8em')
            .style('font-weight', 'bold')
            .style('letter-spacing', 3)
            .style('font-weight', 300)
            .text('Indonesia');

        SVG_HEADER.append('text')
            .attr('x', w / 2)
            .attr('y', margin.top + 20)
            .attr('text-anchor', 'middle')
            .attr('id', 'title')
            .style('font-size', '1.2em')
            .style('font-weight', 'bold')
            .style('font-weight', 300)
            .text('COVID-19 Real-Time Map');

        const covidData = results[0].data.data;
        const topoIDN = results[1].data;
        console.log('getCOVID', covidData);
        console.log('getTopoIDN', topoIDN);

        const data = {};
        covidData.forEach(item => {
            if (item.provinsi === 'DKI Jakarta') item.provinsi = 'Jakarta';
            if (item.provinsi === 'Daerah Istimewa Yogyakarta') item.provinsi = 'Yogyakarta';

            data[item.provinsi] = {
                kasusPosi: item['kasusPosi'],
                kasusMeni: item['kasusMeni'],
                kasusSemb: item['kasusSemb']
            };
        });
        console.log('covidData formatted', data);

        const kasusMinMax = [d3.min(covidData, d => d.kasusPosi), d3.max(covidData, d => d.kasusPosi)];
        console.log('kasusMinMax', kasusMinMax)

        const interpolateScale = d3.scaleLinear(kasusMinMax, [0, 1]); // experimental color

        console.log('feature', topojson.feature(topoIDN, topoIDN.objects.provinces))
        console.log('mesh', topojson.mesh(topoIDN, topoIDN.objects.provinces, (a, b) => a !== b))

        let provinsiFromTopo = [];
        const tooltip = document.querySelector('#tooltip');
        // provinsi path
        SVG_IDN_MAP.append('g')
            .selectAll('path')
            .data(topojson.feature(topoIDN, topoIDN.objects.provinces).features)
            .enter()
            .append('path')
            .attr('class', 'provinsi')
            .attr('stroke', 'black')
            .attr('stroke-width', 0.16)
            .attr('stroke-linejoin', 'round')
            .attr('d', path)
            .on('mouseover', (d, i) => {
                const provinsi = d.properties['provinsi'];
                tooltip.style.visibility = 'visible';
                tooltip.style.left = d3.event.pageX - 65;
                tooltip.style.top = d3.event.pageY - 135;
                tooltip.innerHTML = `${provinsi} 
                <br>Confirmed: ${(data[provinsi].kasusPosi).toLocaleString()} 
                <br>Death: ${(data[provinsi].kasusMeni).toLocaleString()}
                <br>Recovered: ${(data[provinsi].kasusSemb).toLocaleString()}`
            })
            .on('mouseout', (d, i) => {
                tooltip.style.visibility = 'hidden';
                tooltip.style.right = 0;
                tooltip.style.top = 0;
            })
            .on('mousemove', d => {
                tooltip.style.visibility = 'visible';
                tooltip.style.left = d3.event.pageX - 65;
                tooltip.style.top = d3.event.pageY - 135;
            })
            .attr('fill', 'white')
            .transition()
            .delay(function (d, i) { return i * 30; })
            .ease(d3.easeLinear)
            .attr('fill', d => {
                provinsiFromTopo.push(d.properties['provinsi']);
                return d3.interpolateTurbo(interpolateScale(data[`${d.properties['provinsi']}`].kasusPosi)) // experimental color
            });

        // logging
        let provinsiFromCOVID = Object.keys(data);
        console.log('provinsiFromTopo', provinsiFromTopo);
        console.log('provinsiFromCOVID', provinsiFromCOVID);
        console.log('ada di provinsiCOVID tapi gak ada di provinsiTopo', provinsiFromCOVID.filter(item => {
            return !provinsiFromTopo.includes(item)
        }));
        console.log('ada di provinsiTopo tapi gak ada di provinsiCOVID', provinsiFromTopo.filter(item => {
            return !provinsiFromCOVID.includes(item)
        }));

        // ramp template from https://observablehq.com/@d3/color-legend
        function ramp(color, n = 256) {
            const canvas = document.createElement('canvas')
            canvas.setAttribute('width', n)
            canvas.setAttribute('height', 1);
            const context = canvas.getContext("2d");
            for (let i = 0; i < n; ++i) {
                context.fillStyle = color(i / (n - 1));
                context.fillRect(i, 0, 1, 1);
            }
            return canvas;
        }

        // legend template from https://observablehq.com/@d3/color-legend 
        function legend({
            color,
            title,
            tickSize = 6,
            width = 320,
            height = 44 + tickSize,
            marginTop = 18,
            marginRight = 0,
            marginBottom = 16 + tickSize,
            marginLeft = 0,
            ticks = width / 64,
            tickFormat,
            tickValues
        } = {}) {

            const svg = d3.create("svg")
                .attr("width", width)
                .attr("height", height)
                .attr("viewBox", [0, 0, width, height])
                .style("overflow", "visible")
                .style("display", "block")
                .attr('id', 'legend');

            let tickAdjust = g => g.selectAll(".tick line").attr("y1", marginTop + marginBottom - height);
            let x;

            // Continuous
            if (color.interpolate) {
                const n = Math.min(color.kasusMinMax().length, color.range().length);

                x = color.copy().rangeRound(d3.quantize(d3.interpolate(marginLeft, width - marginRight), n));

                svg.append("image")
                    .attr("x", marginLeft)
                    .attr("y", marginTop)
                    .attr("width", width - marginLeft - marginRight)
                    .attr("height", height - marginTop - marginBottom)
                    .attr("preserveAspectRatio", "none")
                    .attr("xlink:href", ramp(color.copy().kasusMinMax(d3.quantize(d3.interpolate(0, 1), n))).toDataURL());
            }

            // Sequential
            else if (color.interpolator) {
                x = Object.assign(color.copy()
                    .interpolator(d3.interpolateRound(marginLeft, width - marginRight)),
                    { range() { return [marginLeft, width - marginRight]; } });

                svg.append("image")
                    .attr("x", marginLeft)
                    .attr("y", marginTop)
                    .attr("width", width - marginLeft - marginRight)
                    .attr("height", height - marginTop - marginBottom)
                    .attr("preserveAspectRatio", "none")
                    .attr("xlink:href", ramp(color.interpolator()).toDataURL());

                // scaleSequentialQuantile doesn’t implement ticks or tickFormat.
                if (!x.ticks) {
                    if (tickValues === undefined) {
                        const n = Math.round(ticks + 1);
                        tickValues = d3.range(n).map(i => d3.quantile(color.kasusMinMax(), i / (n - 1)));
                    }
                    if (typeof tickFormat !== "function") {
                        tickFormat = d3.format(tickFormat === undefined ? ",f" : tickFormat);
                    }
                }
            }

            // Threshold
            else if (color.invertExtent) {
                const thresholds
                    = color.thresholds ? color.thresholds() // scaleQuantize
                        : color.quantiles ? color.quantiles() // scaleQuantile
                            : color.kasusMinMax(); // scaleThreshold

                const thresholdFormat
                    = tickFormat === undefined ? d => d
                        : typeof tickFormat === "string" ? d3.format(tickFormat)
                            : tickFormat;

                x = d3.scaleLinear()
                    .kasusMinMax([-1, color.range().length - 1])
                    .rangeRound([marginLeft, width - marginRight]);

                svg.append("g")
                    .selectAll("rect")
                    .data(color.range())
                    .join("rect")
                    .attr("x", (d, i) => x(i - 1))
                    .attr("y", marginTop)
                    .attr("width", (d, i) => x(i) - x(i - 1))
                    .attr("height", height - marginTop - marginBottom)
                    .attr("fill", d => d);

                tickValues = d3.range(thresholds.length);
                tickFormat = i => thresholdFormat(thresholds[i], i);
            }

            // Ordinal
            else {
                x = d3.scaleBand()
                    .kasusMinMax(color.kasusMinMax())
                    .rangeRound([marginLeft, width - marginRight]);

                svg.append("g")
                    .selectAll("rect")
                    .data(color.kasusMinMax())
                    .join("rect")
                    .attr("x", x)
                    .attr("y", marginTop)
                    .attr("width", Math.max(0, x.bandwidth() - 1))
                    .attr("height", height - marginTop - marginBottom)
                    .attr("fill", color);

                tickAdjust = () => { };
            }

            svg.append("g")
                .attr("transform", `translate(0, ${height - marginBottom})`)
                .call(d3.axisBottom(x)
                    .ticks(ticks, typeof tickFormat === "string" ? tickFormat : undefined)
                    .tickFormat(typeof tickFormat === "function" ? tickFormat : undefined)
                    .tickSize(tickSize)
                    .tickValues(tickValues))
                .call(tickAdjust)
                .call(g => g.select(".kasusMinMax").remove())
                .call(g => g.append("text")
                    .attr("x", marginLeft)
                    .attr("y", marginTop + marginBottom - height - 6)
                    .attr("fill", "currentColor")
                    .attr("text-anchor", "start")
                    .attr("font-weight", "bold")
                    .text(title));

            return svg.node();
        }

        const legendScale = d3.scaleSequential(kasusMinMax, d3.interpolateTurbo); // experimental color
        SVG_IDN_MAP.append('g')
            .attr('transform', `translate(900, -80)`)
            .append(() => legend({ color: legendScale, width: 260, title: 'COVID-19 Confirmed Cases (Person)' }));

        SVG_FOOTER.append('text')
            .attr('x', 780)
            .attr('y', 30)
            .style('font-weight', 100)
            .attr('text-anchor', 'middle')
            .html('Source Data: <a href="https://github.com/mathdroid/indonesia-covid-19-api" id="sourceLink">mathdroid</a>, 2020 Indonesia COVID-19.');
    });
