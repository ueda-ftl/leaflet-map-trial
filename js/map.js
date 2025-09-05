(() => {
    "use strict";

    function _trajectoryMarker(latlng, r) {
        return L.circleMarker(latlng, {
            radius: 5 * r,
            stroke: false,
            fillColor: "green",
            fillOpacity: 0.8 * r,
        });
    }

    function _trajectoryPoints(latlngs, n) {
        return latlngs.toReversed().map((e, i) => _trajectoryMarker(e, (n - i) / n));
    }

    function _trajectoryPolyline(latlngs, w) {
        return L.polyline(latlngs, {
            weight: w,
            color: "green",
            opacity: 0.5,
        });
    }

    function updateTrajectory(g_p, g_l, latlng, n) {
        // 現在位置情報を追加、移動軌跡を再描画
        const latlngs = g_p.getLayers().slice(-(n - 1)).map((e) => e.getLatLng());
        latlngs.push(latlng);
        g_p.clearLayers();
        _trajectoryPoints(latlngs, n).map((e) => e.addTo(g_p));
        g_l.clearLayers();
        _trajectoryPolyline(latlngs, 2).addTo(g_l);
    }

    const iconFavorite = L.AwesomeMarkers.icon({
        icon: "bookmark",
        markerColor: "red",
    });
    function _favoriteMarker(latlng) {
        return L.marker(latlng, {
            icon: iconFavorite,
            opacity: 0.8,
            draggable: true,
        });
    }

    function _favoriteCircle(latlng, radius) {
        return L.circle(latlng, {
            radius: radius,
            color: "red",
            fillColor: "red",
            opacity: 0.4,
            fillOpacity: 0.1,
        });
    }

    function addFavorite(g, latlng, radius) {
        // POI位置情報を追加、その表示を更新
        const circle = _favoriteCircle(latlng, radius).addTo(g);
        const marker = _favoriteMarker(latlng).addTo(g).on("dragend", (e) => {
            circle.setLatLng(marker.getLatLng());
        });
    }
    
    function _latlngs_csv(g) {
        const header = "lat,lng";
        const latlngs = g.getLayers().map((e) => e.getLatLng());
        const body = latlngs.map((e) => `${e.lat},${e.lng}`).join("\n");
        return header + "\n" + body;
    }

    function downloadCSV(g) {
        // LayerGroup の座標列をCSVとしてダウンロード
        const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
        // リンククリエイト
        const downloadLink = document.createElement("a");
        downloadLink.download = "latlngs.csv";
        // ファイル情報設定
        downloadLink.href = URL.createObjectURL(new Blob([bom, _latlngs_csv(g)], {
            type: "text/csv"
        }));
        downloadLink.dataset.downloadurl = ["text/csv", downloadLink.download, downloadLink.href].join(":");
        // イベント実行
        downloadLink.click();
    }

    function updateUrlWithFavorites(favorite) {
        // favorite 座標列を URLクエリに追加
        const layers = favorite.getLayers();
        if (layers.length === 0) return;
        const latlngs = layers.map((e) => e.getLatLng());
        const coords = latlngs.map(e => [e.lat, e.lng]);
        const encoded = encodePolyline(coords);
        const params = new URLSearchParams(location.search);
        params.set("fav", encoded);
        const newUrl = `${location.pathname}?${params.toString()}`;
        history.replaceState(null, "", newUrl);
    }

    function restoreFavoritesByUrl(favorite) {
        // URL から favorite を復元
        const params = new URLSearchParams(location.search);
        if (params.has("fav")) {
            const decoded = decodePolyline(params.get("fav"));
            decoded.forEach(([lat, lng]) => {
                addFavorite(favorite, L.latLng(lat, lng), 30.0);
            });
        }
    }

    // tile レイヤ
    const tiles = {
        osm: L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxNativeZoom: 19,
            maxZoom: 21,
            attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        }),
        google: L.tileLayer("https://mt1.google.com/vt/lyrs=r&x={x}&y={y}&z={z}", {
            maxNativeZoom: 21,
            maxZoom: 21,
            attribution: '&copy; <a href="https://developers.google.com/maps/documentation">Google Map</a>'
        }),
    };
    // overlay レイヤ
    const current = L.layerGroup();
    const traj_p = L.layerGroup();
    const traj_l = L.layerGroup();
    const favorite = L.layerGroup();
    // map 生成
    const map = L.map("map", {
        layers: [ tiles.osm, current, traj_p, traj_l, favorite ],
        center: L.latLng(35.6251316, 139.7219512),
        zoomControl: false,
        zoom: 16,
        minZoom: 12,
    }).fitWorld();
    L.control.layers(tiles, { current, traj_p, traj_l, favorite }).addTo(map);
    L.control.scale({imperial: false}).addTo(map);
    L.control.locate({
        position: "bottomleft",
        layer: current,
        locateOptions: {
            maxZoom: 18,
            enableHighAccuracy: true,
        },
        keepCurrentZoomLevel: false,
        initialZoomLevel: 13,
        //circleStyle: {
        //    stroke: true,
        //    weight: 1,
        //    opacity: 0.3,
        //    fillOpacity: 0.02,
        //},
    }).addTo(map).start();
    restoreFavoritesByUrl(favorite);

    // 座標列全削除ボタン
    L.easyButton("fa-solid fa-ban", () => {
        if (favorite.getLayers().length === 0 && traj_p.getLayers().length === 0) return;
        const result = confirm("remove all favorite and trajectory");
        if (result) {
            favorite.clearLayers();
            traj_p.clearLayers();
            traj_l.clearLayers();
        }
    }).addTo(map);
    // favorite 追加ボタン
    L.easyButton("fa-regular fa-square-plus", () => {
        const layers = current.getLayers();
        if (layers.length === 0) return;
        const latlng = layers[0].getLatLng();
        if (latlng === null) return;
        addFavorite(favorite, latlng, 30.0);
    }).addTo(map);
    // favorite 最終登録削除ボタン
    L.easyButton("fa-regular fa-square-minus", () => {
        const layers = favorite.getLayers();
        if (layers.length === 0) return;
        favorite.removeLayer(layers.slice(-1)[0]);
    }).addTo(map);
    // favorite CSVダウンロードボタン
    // L.easyButton("fa-solid fa-download", () => {
    // 	downloadCSV(favorite);
    // }).addTo(map);
    // favorite URL保存ボタン
    L.easyButton("fa-solid fa-bookmark", () => {
        updateUrlWithFavorites(favorite)
    }).addTo(map);

    // 現在位置検知時、その場所にマーカを表示
    map.on("locationfound", (e) => updateTrajectory(traj_p, traj_l, e.latlng, 100));
    // 検知失敗時、alert表示
    //map.on("locationerror", (e) => alert(e.message));

    // イベントハンドラ登録

    // location検知要求
    //map.locate({
    //    maxZoom: 16,
    //    watch: true
    //});
})();
