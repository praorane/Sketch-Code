// Copyright (c) Microsoft Corporation. All rights reserved
//  basic-layout.service.ts
//  The implementation of various map view services

/// <reference path="../../Scripts/typings/angularjs/angular.d.ts" />

module SketchSvg {
    'use strict';

    export enum TileAlignment {
        None,
        Next,
        Previous
    }

    export class RackTileStatus {
        static available: string = 'Available';
        static reserved: string = 'Reserved';
        static used: string = 'Used';
        static error: string = 'Error';
    }

    export interface ITileRect extends IRect {
        originalTile: ITileInfo;
        tileAlignment: TileAlignment;
    }

    export interface IRackRenderingData {
        availableTilesPath: string;
        reservedTilesPath: string;
        usedTilesPath: string;
        errorTilesPath: string;
    }

    export class SpaceRendererFactory {
        private static _charCodeA = 65;

        constructor(private $log: angular.ILogService, private $q: angular.IQService) {
        }

        public static numberToAlphabet(xStartCharCode0: number, xStartCharCode1: number, value: number)
            : string {
            /// <summary>Converts a numeric value to an alphabet based string for example, column start with "AA". Then 0 => "AA", 1 => "AB"...</summary>
            /// <param name="xStartCharCode0" type="Number">The first char code of the first label from the end of string</param>
            /// <param name="xStartCharCode1" type="Number">The secon char code of the first label from the end of string</param>
            /// <param name="value" type="Number">the numeric value which needs to be convered into a string</param>
            /// <returns type="String">A string label</returns>
            var startNumber = (xStartCharCode0 - SpaceRendererFactory._charCodeA)
                * 26 + xStartCharCode1 - SpaceRendererFactory._charCodeA;
            value += startNumber;
            var char0 = SpaceRendererFactory._charCodeA + Math.floor(value / 26);
            var char1 = SpaceRendererFactory._charCodeA + value % 26;
            return String.fromCharCode(char0, char1);
        }

        public static alphabetToNumber(start: string, alphabet: string)
            : number {
            /// <summary>Converts a column label such as  "AE" to a number. For example, column start with "AA". Then "AA" => 0, "AB" => 1...</summary>
            /// <param name="start" type="String">The label of the first column</param>
            /// <param name="alphabet" type="String">The label which needs to be converted</param>
            /// <returns type="Number">A numberic value of the label. Zero based.</returns>
            return ((alphabet.charCodeAt(0) - start.charCodeAt(0)) * 26
                + (alphabet.charCodeAt(1) - start.charCodeAt(1)));
        }

        public getBackgroundPathAsync(coloXStart, coloYStart, coloXSize, coloYSize, xDelta, yDelta, headerHeight, footerHeight, xMargin, yMargin) {
            /// <summary>Gets background svg path data including the axes labels asynchronously.</summary>
            /// <param name="coloXStart" type="String">A string which represents the start column of the tile grid</param>
            /// <param name="coloYStart" type="Number">A number which represents the start row of the tile grid</param>
            /// <param name="xDelta" type="Number">Width of each tile</param>
            /// <param name="yDelta" type="Number">Height of each tile</param>
            /// <param name="headerHeight" type="Number">Heigth of Map head area</param>
            /// <param name="footerHeight" type="Number">Heigth of Map footer area</param>
            /// <param name="xMargin" type="Number">Additional horizontal margin on both side</param>
            /// <param name="yMargin" type="Number">additional vertical margin on both side</param>
            /// <returns type="Promise">A promise object</returns>

            var deferred = this.$q.defer();

            var colotStartXCharCode0 = coloXStart.charCodeAt(0);
            var colotStartXCharCode1 = coloXStart.charCodeAt(1);

            var yTopLabels = 0;
            var yBottomLabels = headerHeight + yMargin + coloYSize * yDelta;

            // Scan X axis
            var topMargin = headerHeight + yMargin;
            var xAxis = this._scanXAxis(
                xMargin, xDelta, coloXSize, colotStartXCharCode0, colotStartXCharCode1,
                topMargin, yDelta, coloYSize);

            //  2. Scan Y axis
            var xLeftLabels = 0;
            var xRightLabels = xMargin + coloXSize * xDelta;
            var yAxis = this._scanYAxis(
                topMargin, yDelta, coloYSize, coloYStart,
                xMargin, xDelta, coloXSize);

            deferred.resolve({
                guidelinesPath: xAxis.pathData + yAxis.pathData,
                xLabels: xAxis.labels,
                yLabels: yAxis.labels,
                yTopLabels: yTopLabels,
                yBottomLabels: yBottomLabels,
                xLeftLabels: xLeftLabels,
                xRightLabels: xRightLabels,
            });


            // Return rendering data
            return deferred.promise;
        }

        public getTileSpacePathAsync(
            tiles,
            coloXStart, coloYStart,
            xDelta, yDelta,
            headerHeight, footerHeight,
            xMargin, yMargin
        ): angular.IPromise<IRackRenderingData> {
            /// <summary>Gets tile space svg path data asynchronously.</summary>
            /// <param name="tiles" type="Array">A collection of tiles</param>
            /// <param name="coloXStart" type="String">A string which represents the start column of the tile grid</param>
            /// <param name="coloYStart" type="Number">A number which represents the start row of the tile grid</param>
            /// <param name="xDelta" type="Number">Width of each tile</param>
            /// <param name="yDelta" type="Number">Height of each tile</param>
            /// <param name="headerHeight" type="Number">Heigth of Map head area</param>
            /// <param name="footerHeight" type="Number">Heigth of Map footer area</param>
            /// <param name="xMargin" type="Number">Additional horizontal margin on both side</param>
            /// <param name="yMargin" type="Number">additional vertical margin on both side</param>
            /// <returns type="Promise">A promise object</returns>

            var deferred = this.$q.defer();

            var colotStartXCharCode0 = coloXStart.charCodeAt(0);
            var colotStartXCharCode1 = coloXStart.charCodeAt(1);

            var usedTilesPath = '';
            var reservedTilesPath = '';
            var availableTilesPath = '';
            var errorTilesPath = '';
            var rectPath;
            var topMargin = headerHeight + xMargin;
            var rackTiles = tiles.filter((tile) => {
                return tile.Class === 'Server' || tile.Class === 'Network'
            });

            var rackRects = SpaceRendererFactory.getBoundingRectsForRackTiles(rackTiles,
                            coloXStart, coloYStart, xDelta, yDelta, 
                            headerHeight, footerHeight, xMargin, yMargin);

            rackRects.forEach((rackRect) => {
                rectPath = 'M ' + rackRect.x.toString() + ' ' + rackRect.y.toString()
                    + ' L ' + (rackRect.x + rackRect.width).toString() + ' ' + rackRect.y.toString()
                    + ' L ' + (rackRect.x + rackRect.width).toString() + ' ' + (rackRect.y + rackRect.height).toString()
                    + ' L ' + (rackRect.x).toString() + ' ' + (rackRect.y + rackRect.height).toString()
                    + ' Z ';

                switch (rackRect.originalTile.Status) {
                    case RackTileStatus.available:
                        availableTilesPath += rectPath;
                        break;
                    case RackTileStatus.reserved:
                        reservedTilesPath += rectPath;
                        break;
                    case RackTileStatus.used:
                        usedTilesPath += rectPath;
                        break;
                    case RackTileStatus.error:
                        errorTilesPath += rectPath;
                        break;
                }
            });

            deferred.resolve({
                availableTilesPath: availableTilesPath,
                reservedTilesPath: reservedTilesPath,
                usedTilesPath: usedTilesPath,
                errorTilesPath: errorTilesPath,
            });

            // Return rendering data
            return deferred.promise;
        }

        public static getBoundingRectsForRackTiles(
            tiles: Array<ITileInfo>,
            coloXStart: string,
            coloYStart: number,
            xDelta: number,
            yDelta: number,
            headerHeight: number,
            footerHeight: number,
            xMargin: number,
            yMargin: number
        ): Array<ITileRect>  {

            var colotStartXCharCode0 = coloXStart.charCodeAt(0);
            var colotStartXCharCode1 = coloXStart.charCodeAt(1);
            var topMargin = headerHeight + yMargin;
            var rects = [];
            tiles.forEach((tile) => {
                var xLoc = tile.X;
                var yLoc = tile.Y;
                var width = xDelta;
                var height = yDelta;
                var alignment = TileAlignment.None;
                switch (tile.AssocDirection) {
                    case 'Right':
                        xLoc = tile.X;
                        yLoc = tile.Y;
                        width = 2 * xDelta;
                        alignment = TileAlignment.Next;
                        break;
                    case 'Left':
                        xLoc = SpaceRendererFactory.numberToAlphabet(colotStartXCharCode0, colotStartXCharCode1,
                            SpaceRendererFactory.alphabetToNumber(coloXStart, tile.X) - 1);
                        yLoc = tile.Y;
                        width = 2 * xDelta;
                        alignment = TileAlignment.Previous;
                        break;
                    // TODO: Swap "Down" and "Top" once Tien fixes GetStatusTiles on the service side
                    case 'Down':
                        xLoc = tile.X;
                        yLoc = (parseInt(tile.Y) - 1).toString();
                        height = 2 * yDelta;
                        alignment = TileAlignment.Next;
                        break;
                    case 'Up':
                        xLoc = tile.X;
                        yLoc = tile.Y;
                        height = 2 * yDelta;
                        alignment = TileAlignment.Previous;
                        break;
                }

                var yPos = (parseInt(yLoc) - coloYStart) * yDelta + topMargin;
                var xPos = SpaceRendererFactory.alphabetToNumber(coloXStart, xLoc) * xDelta + xMargin;

                rects.push({
                    originalTile: tile,
                    tileAlignment: alignment,
                    x: xPos,
                    y: yPos,
                    width: width,
                    height: height
                });
            });

            return rects;
        }

        public static getBoundingRectsForGroups(
            subgroups: Array<any>,
            coloXStart: string,
            coloYStart: number,
            xDelta: number,
            yDelta: number,
            headerHeight: number,
            footerHeight: number,
            xMargin: number,
            yMargin: number
        ): Array<IRect> {
            /// <summary>Calculates the bounding box collection for a given subgroups</summary>
            /// <param name="subgroups" type="Array">A collection of subgroups</param>
            /// <param name="coloXStart" type="String">A string which represents the start column of the tile grid</param>
            /// <param name="coloYStart" type="Number">A number which represents the start row of the tile grid</param>
            /// <param name="xDelta" type="Number">Width of each tile</param>
            /// <param name="yDelta" type="Number">Height of each tile</param>
            /// <param name="headerHeight" type="Number">Heigth of Map head area</param>
            /// <param name="footerHeight" type="Number">Heigth of Map footer area</param>
            /// <param name="xMargin" type="Number">Additional horizontal margin on both side</param>
            /// <param name="yMargin" type="Number">additional vertical margin on both side</param>
            /// <returns type="Array">An array of rects</returns>
            var colotStartXCharCode0 = coloXStart.charCodeAt(0);
            var colotStartXCharCode1 = coloXStart.charCodeAt(1);
            var topMargin = headerHeight + xMargin;
            var xLoc, yLoc, width, height;
            var rects = [];
            subgroups.forEach((subgroup) => {
                var startTile = subgroup.startTile;
                var endTile = subgroup.endTile;

                switch (startTile.AssocDirection) {
                    case 'Right':
                        xLoc = startTile.X;
                        yLoc = startTile.Y;
                        width = 2 * xDelta;
                        break;
                    case 'Left':
                        xLoc = SpaceRendererFactory.numberToAlphabet(colotStartXCharCode0, colotStartXCharCode1,
                            SpaceRendererFactory.alphabetToNumber(coloXStart, startTile.X) - 1);
                        yLoc = startTile.Y;
                        width = 2 * xDelta;
                        break;
                    // TODO: Swap "Down" and "Top" once Tien fixes GetStatusTiles on the service side
                    case 'Down':
                        xLoc = startTile.X;
                        yLoc = startTile.Y - 1;
                        height = 2 * yDelta;
                        break;
                    case 'Up':
                        xLoc = startTile.X;
                        yLoc = startTile.Y;
                        height = 2 * yDelta;
                        break;
                }

                if (startTile.X === endTile.X) {
                    height = (endTile.Y - startTile.Y + 1) * yDelta;
                } else if (startTile.Y === endTile.Y) {
                    width = (SpaceRendererFactory.alphabetToNumber(coloXStart, endTile.X)
                        - SpaceRendererFactory.alphabetToNumber(coloXStart, startTile.X) + 1) * xDelta;
                } else {
                    // TODO: Unexpected - error? or asset?
                }

                rects.push({
                    x: SpaceRendererFactory.alphabetToNumber(coloXStart, xLoc) * xDelta + topMargin,
                    y: (parseInt(yLoc) - coloYStart) * yDelta + yMargin,
                    width: width,
                    height: height
                });
            });

            return rects;
        }

        private _scanXAxis(xMargin, xDelta, coloXSize, colotStartXCharCode0, colotStartXCharCode1, topMargin, yDelta, coloYSize) {
            /// <param name="xMargin" type="Number">xMargin</param>
            /// <param name="xDelta" type="Number">xDelta</param>
            /// <param name="coloXSize" type="Number">coloXSize</param>
            /// <param name="colotStartXCharCode0" type="Number">colotStartXCharCode0</param>
            /// <param name="colotStartXCharCode1" type="Number">colotStartXCharCode1</param>
            /// <param name="topMargin" type="Number">topMargin</param>
            /// <param name="yDelta" type="Number">yDelta</param>
            /// <param name="coloYSize" type="Number">coloYSize</param>
            /// <returns type="Object">An Object</returns>

            var topLine = topMargin.toString();
            var bottomLine = (topMargin + coloYSize * yDelta).toString();
            var pathData = '';

            var xLine;
            var labels = [];
            for (var i = 0; i < coloXSize; i++) {
                xLine = (xDelta * i + xMargin).toString();
                labels.push({
                    x: xDelta * (i + 0.5) + xMargin,
                    text: SpaceRendererFactory.numberToAlphabet(colotStartXCharCode0, colotStartXCharCode1, i)
                });
                pathData += 'M ' + xLine + ' ' + topLine + ' L ' + xLine + ' ' + bottomLine;
            }

            xLine = (xDelta * i + xMargin).toString();
            pathData += 'M ' + xLine + ' ' + topLine + ' L ' + xLine + ' ' + bottomLine;

            return {
                pathData: pathData,
                labels: labels
            };
        }

        private _scanYAxis(topMargin, yDelta, coloYSize, coloYStart, xMargin, xDelta, coloXSize) {
            /// <summary>Gets tile space svg path data asynchronously.</summary>
            /// <param name="topMargin" type="Number">topMargin</param>
            /// <param name="yDelta" type="Number">yDelta</param>
            /// <param name="coloYSize" type="Number">coloYSize</param>
            /// <param name="coloYStart" type="Number">coloYStart</param>
            /// <param name="xMargin" type="Number">xMargin</param>
            /// <param name="xDelta" type="Number">xDelta</param>
            /// <param name="coloXSize" type="Number">coloXSize</param>
            /// <returns type="Object">An Object</returns>

            var leftLine = xMargin.toString();
            var rightLine = (xMargin + coloXSize * xDelta).toString();
            var pathData = '';

            var yLine;
            var labels = [];
            for (var i = 0; i < coloYSize; i++) {
                yLine = (yDelta * i + topMargin).toString();
                labels.push({
                    y: yDelta * (i + 0.7) + topMargin,
                    text: (coloYStart + i).toString()
                });
                pathData += 'M ' + leftLine + ' ' + yLine + ' L ' + rightLine + ' ' + yLine;
            }

            yLine = (yDelta * i + topMargin).toString();
            pathData += 'M ' + leftLine + ' ' + yLine + ' L ' + rightLine + ' ' + yLine;

            return {
                pathData: pathData,
                labels: labels
            };
        }
    }

    export class PowerCoolingRenderFactory {
        constructor(private _dataModelService: DataModelService, private $log: angular.ILogService, private $q: angular.IQService) {
        }

        public getColdAislesPathAsync(
            tiles,
            coloXStart, coloYStart,
            xDelta, yDelta,
            headerHeight, footerHeight,
            xMargin, yMargin
        ) {
            /// <summary>Gets cold aisles svg path data asynchronously.</summary>
            /// <param name="tiles" type="Array">A collection of tiles</param>
            /// <param name="coloXStart" type="String">A string which represents the start column of the tile grid</param>
            /// <param name="coloYStart" type="Number">A number which represents the start row of the tile grid</param>
            /// <param name="xDelta" type="Number">Width of each tile</param>
            /// <param name="yDelta" type="Number">Height of each tile</param>
            /// <param name="headerHeight" type="Number">Heigth of Map head area</param>
            /// <param name="footerHeight" type="Number">Heigth of Map footer area</param>
            /// <param name="xMargin" type="Number">Additional horizontal margin on both side</param>
            /// <param name="yMargin" type="Number">additional vertical margin on both side</param>
            /// <returns type="Promise">A promise object</returns>

            var deferred = this.$q.defer();

            var coldAislesPath = '';
            var topMargin = headerHeight + xMargin;
            tiles.forEach((tile) => {
                if (tile.Class !== 'Cold') {
                    return;
                }

                var xLoc = tile.X;
                var yLoc = tile.Y;
                var width = xDelta;
                var height = yDelta;

                var yPos = (parseInt(yLoc) - coloYStart) * yDelta + yMargin;
                var xPos = SpaceRendererFactory.alphabetToNumber(coloXStart, xLoc) * xDelta + topMargin;

                coldAislesPath += 'M ' + xPos.toString() + ' ' + yPos.toString()
                    + ' L ' + (xPos + width).toString() + ' ' + yPos.toString()
                    + ' L ' + (xPos + width).toString() + ' ' + (yPos + height).toString()
                    + ' L ' + (xPos).toString() + ' ' + (yPos + height).toString()
                    + ' Z ';
            });

            deferred.resolve({
                coldAislesPath: coldAislesPath
            });

            // Return rendering data
            return deferred.promise;
        }

        public getReservedTileRectanglesAsync(
            dataCenterId: number,
            colocationId: number,
            reservedtiles: Array<ITileInfo>,
            coloXStart: string,
            coloYStart: number,
            xDelta: number,
            yDelta: number,
            headerHeight: number,
            footerHeight: number,
            xMargin: number,
            yMargin: number
        ): angular.IPromise<any> {
            return this._dataModelService.getGroupReservationsAtDataCenterAsync(dataCenterId.toString())
                .then((groupReservationData: GroupReservationDataAtDataCenter) => {

                    return this._dataModelService.findAndCacheSkuDetailsByMsfPartNumbersAsync(
                        groupReservationData.listOfMsfPartNumbers
                    ).then((ok: boolean) => {
                        var rects = SpaceRendererFactory.getBoundingRectsForRackTiles(
                            reservedtiles,
                            coloXStart, coloYStart,
                            xDelta, yDelta,
                            headerHeight, footerHeight,
                            xMargin, yMargin);

                        var results: Array<any> = [];

                        rects.forEach((rect) => {
                            var msfPartNumber = groupReservationData.getRackReservationByTileId(rect.originalTile.Id).msfPartNumber;
                            var power = this._dataModelService.getSkuDetailByMsfPartNumberFromCache(msfPartNumber).SkuPowerAt100pctLoadW;

                            results.push({
                                power: power,
                                x: rect.x,
                                y: rect.y,
                                width: rect.width,
                                height: rect.height
                            });
                        });

                        return results;
                    });
                });
        }

        public getDeployedRackPowerAsync(
            dataCenterId: number,
            colocationId: number,
            deployTiles: Array<ITileInfo>,
            coloXStart: string,
            coloYStart: number,
            xDelta: number,
            yDelta: number,
            headerHeight: number,
            footerHeight: number,
            xMargin: number,
            yMargin: number
        ): angular.IPromise<any> {
            return this._dataModelService.getRackDataAtDataCenter(dataCenterId).then((rackData: RackDataAtDataCenter) => {
                var rects = SpaceRendererFactory.getBoundingRectsForRackTiles(
                    deployTiles,
                    coloXStart, coloYStart,
                    xDelta, yDelta,
                    headerHeight, footerHeight,
                    xMargin, yMargin);

                var results: Array<any> = [];

                rects.forEach((rect) => {
                    var power: string | number = 'n/a';

                    if (rect.originalTile.Class === 'Server' && rect.originalTile.Status === 'Used') {
                        var rack = rackData.getRackInformationByTileName(colocationId, rect.originalTile.Name);
                        if (rack !== undefined) {
                            power = rack.PowerConsumed;
                        }
                    }

                    results.push({
                        power: power,
                        x: rect.x,
                        y: rect.y,
                        width: rect.width,
                        height: rect.height
                    });
                });

                return results;
            });
        }
    }
};