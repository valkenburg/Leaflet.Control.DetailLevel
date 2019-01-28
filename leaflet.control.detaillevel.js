/**
    L.Control.DetailLevel by Wessel Valkenburg, released under MIT License.

    Copyright 2019 Wessel Valkenburg

    Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

    The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/


L.Control.DetailLevel = L.Control.extend({

    options: {
        position: "topright"
    },

    initialize : function (defaultLevel, minOffset, maxOffset) {
        /* leave the possibility open for a user to have layers with different
           zoomOffsets already. This control should be agnostic about that, so
           we track our internal counter which satisfies the set maximum, and just
           add this number to whatever the initialized layers have already set. */
        this.internalOffsetCounter = defaultLevel;

        /* default to a maximum offset of 3, since 2^3 = 8 tiles per canonical tile already. */
        this.maxOffset = maxOffset == null ? 3 : Math.max(maxOffset, 0);
        this.minOffset = minOffset == null ? 0 : Math.max(minOffset, -10);

        /* avoid too many taps on the buttons when the map is still updating. */
        this.updateLock = false;
    },

    onMapStartLoad : function () {
        /* block changes during map building */
        this.updateLock = true;
    },

    onMapFinishLoad : function () {
        /* unblock changes after map finished building */
        this.updateLock = false;
    },

    attachLoadListeners : function (map) {
        map.on("loading", this.onMapStartLoad.bind(this));
        map.on("load", this.onMapFinishLoad.bind(this));
    },

    onAdd : function (map) {

        this.map = map;
        
        this.map.on("layeradd", this.refresh.bind(this));

        this.attachLoadListeners(map);

        this.container = L.DomUtil.create("DIV", "leaflet-bar leaflet-control leaflet-control-custom");

        this.aPlus = this.makeButton("D+", this.increaseDetail.bind(this));

        this.countShow = this.makeButton("0", function(){});

        this.aMinus = this.makeButton("D-", this.decreaseDetail.bind(this));

        this.container.appendChild(this.aPlus);
        this.container.appendChild(this.countShow);
        this.container.appendChild(this.aMinus);

        return this.container;
    },

    makeButton : function (innerText, callback) {
        let result = L.DomUtil.create("A");
        result.href = "#";
        result.style.font = "bold 18px 'Lucida Console', Monaco, monospace";
        result.addEventListener("click", callback);
        result.innerText = innerText;
        return result;
    },

    increaseDetail : function(evt) {
        this.changeDetail(1);
        if(evt) evt.stopPropagation();
    },

    decreaseDetail : function(evt) {
        this.changeDetail(-1);
        if(evt) evt.stopPropagation();
    },

    canChangeDetail : function (delta) {
        /* first check that we can change the detail for all layers. */
        let canDoZoom =
            this.internalOffsetCounter + delta <= this.maxOffset
         && this.internalOffsetCounter + delta >= this.minOffset;
        return canDoZoom;

        let me = this;

        if (canDoZoom) {
            this.map.eachLayer(function (layer) {
                if ( "zoomOffset" in layer.options ) {
                    /* when incrementing zoomOffset, we decrement
                       maxZoom. This means that zoomOffset + maxZoom is a constant, reflecting the actual maxZoom of the map source. */
                    let maxZoom_gaugeIndependent = ( (undefined !== layer.options.maxNativeZoom) ? layer.options.maxNativeZoom : layer.options.maxZoom) + layer.options.zoomOffset;
                    let minZoom_gaugeIndependent = layer.options.minZoom + layer.options.zoomOffset;
                    let nextZoomIfApplied = layer._tileZoom + layer.options.zoomOffset + delta;
                    canDoZoom = canDoZoom
                        && nextZoomIfApplied >= minZoom_gaugeIndependent
                        && nextZoomIfApplied <= maxZoom_gaugeIndependent
                          ;
                }
            });
        }
        return canDoZoom;
    },

    attachDirtToLayer : function (layer) {
        if ( layer.options._detailLevelControlInfo ) return;
        let dirt = {
            tileSize : layer.options.tileSize,
            maxZoom : layer.options.maxZoom,
            minZoom : layer.options.minZoom,
            maxNativeZoom : layer.options.maxNativeZoom,
            minNativeZoom : layer.options.minNativeZoom,
            zoomOffset : layer.options.zoomOffset
        };
        layer.options._detailLevelControlInfo = dirt;
    },

    changeDetail : function (delta) {
        if ( this.updateLock ) return;


        if ( this.canChangeDetail(delta) ) {

            this.internalOffsetCounter += delta;
            let newOffset = this.internalOffsetCounter;
            this.countShow.innerText = this.internalOffsetCounter;

            let overallMaxZoom = -1;
            let overallMinZoom = 1e30;
            let me = this;
            this.map.eachLayer(function (layer) {
                if ( "zoomOffset" in layer.options ) {

                    me.attachDirtToLayer(layer);
                    let native = layer.options._detailLevelControlInfo;

                    layer.options.tileSize = Math.round(Math.pow(2, -newOffset) * native.tileSize);

                    layer.options.zoomOffset = native.zoomOffset + newOffset;

                    /* use native max / min zooms here:
                       leaflet smartly scales the images when we go beyond
                       the native zooms. That is exactly what we need:
                       if the offset zoom is maxed out, allow for scaling.
                       So, adapt the native zooms according to our offset. */
                    if (undefined !== native.maxNativeZoom)  {
                        layer.options.maxNativeZoom = native.maxNativeZoom - newOffset;
                    } else {
                        layer.options.maxNativeZoom = native.maxZoom - newOffset;
                    }

                    overallMaxZoom = Math.max(overallMaxZoom, layer.options.maxZoom);

                    if (undefined !== native.minNativeZoom)  {
                        layer.options.minNativeZoom = native.minNativeZoom - newOffset;
                    } else {
                        layer.options.minNativeZoom = native.minZoom - newOffset;
                    }
                    overallMinZoom = Math.min(overallMinZoom, layer.options.minZoom);

                    layer._resetGrid();
                }
            });

            /* need to propagate the limits to the global map */
            this.map.setMaxZoom(overallMaxZoom);
            this.map.setMinZoom(overallMinZoom);

            /* rebuild the view */
            this.map._resetView(this.map.getCenter(), this.map.getZoom());
        }

    },
    refresh : function() {
        this.changeDetail(0);
    }

});
