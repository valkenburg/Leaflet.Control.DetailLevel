# Leaflet.Control.DetailLevel
Add a simple control to bump the zoomOffset beyond the default / retine / hdpi setting. This allows you to view higher zoom-level tiles in a large display. Mind your bandwidth, though.

# Demo
[Demo](https://valkenburg.github.io/Leaflet.Control.DetailLevel/demo.html)

# Usage
The simplest is to include this plugin after including leaflet:

```html
    <script src="leaflet.js"></script>
    <script src="leaflet.control.detaillevel.js"></script>
```

and then add your control using
```javascript
    let detailControl = new L.Control.DetailLevel(0, 4);
    detailControl.addTo(map);
```

where the  arguments to the constructor are your mininum and maximum detail level == minimum/maximum zoomOffset. Please be aware that the number of tiles on display grows as `2^(zoomOffset)`, meaning that with `zoomOffset = 3` you already display `8` times as many tiles as you would ordinarily.

## License

This plugin is licensed under the MIT license, which is included in the head of the source file. Meaning: do whatever you want, but you cannot blame me if anything breaks.

