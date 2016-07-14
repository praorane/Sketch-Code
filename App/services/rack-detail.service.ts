// Copyright (c) Microsoft Corporation. All rights reserved
//  rack-detail.service.ts
//  The implementation of rack detail renderer service

/// <reference path="../../Scripts/typings/angularjs/angular.d.ts" />
/// <reference path="../defs/common-types.d.ts" />

module SketchSvg {
    'use strict';

    // This map contains RegExes used for indicating
    // known property group families based on various band names.
    var _propertyGroupRegExMap: {
        [propertyGroup: string]: Array<RegExp>
    } = {
        'azure': [/azure/i, /^AP$/i, /^WA$/i],
        'office': [/office/i, /o365/i],
        'dynamics': [/dynamics/i],
        'onedrive': [/onedrive/i],
        'sharepoint': [/sharepoint/i],
        'xbox': [/xbox/i],
        'exchange': [/exchange/i],
        'cosmos': [/cosmos/i],
    };

    export interface IPropertyGroupInfo {
        label: string;
        x: number;
        y: number;
        width: number;
        height: number;
    }

    export class RackDetailRendererFactory {
        private static _propertyGroupNameToCssClassMap: {
            [name: string]: string
        } = {};

        constructor(private dataModelService: DataModelService, private $log: angular.ILogService, private $q: angular.IQService) {
            /// <summary>Implements property group Rendering</summary>
            /// <param name="dataLoader" type="Object">dataLoader</param>
            /// <param name="$log" type="Object">$log</param>
            /// <param name="$q" type="Object">$q</param>
        }

        public getPropertyGroupsAsync(
            tiles: Array<ITileInfo>,
            coloXStart: string,
            coloYStart: number,
            xDelta: number,
            yDelta: number,
            headerHeight: number,
            footerHeight: number,
            xMargin: number,
            yMargin: number
        ): angular.IPromise<Array<IPropertyGroupInfo>> {
            /// <summary>Retrieves the property groups collection</summary>
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

            return this._getPropertyGroupsAsync(tiles)
                .then((groups) => {
                    var renderingGroups = [];
                    groups.forEach((group) => {
                        var rects = SpaceRendererFactory.getBoundingRectsForGroups(
                            group.subgroups,
                            coloXStart, coloYStart,
                            xDelta, yDelta,
                            headerHeight, footerHeight,
                            xMargin, yMargin);
                        rects.forEach((rect) => {
                            renderingGroups.push({
                                label: group.name,
                                x: rect.x,
                                y: rect.y,
                                width: rect.width,
                                height: rect.height
                            });
                        });
                    });

                    return renderingGroups;
                });
        }

        public static filterCSSClassName() {
            return (propertyGroupName: string): string => {
                var propertyGroupFamily = 'other';
                
                // Check whether we cache this band name in our CSS class map
                if (!RackDetailRendererFactory._propertyGroupNameToCssClassMap[propertyGroupName]) {
                    // Not found in the cache. Run RegExes to figure out the family this band belongs to.
                    var found = false;
                    for (var knownPropertyGroup in _propertyGroupRegExMap) {
                        var regExes = _propertyGroupRegExMap[knownPropertyGroup];
                        for (var i = 0; i < regExes.length; i++) {
                            if (regExes[i].test(propertyGroupName)) {
                                propertyGroupFamily = knownPropertyGroup;
                                RackDetailRendererFactory._propertyGroupNameToCssClassMap[propertyGroupName]
                                    = knownPropertyGroup;
                                found = true;
                                break;
                            }
                        }
                        if (found) {
                            // Bail out from the outer loop.
                            break;
                        }
                    }
                } else {
                    propertyGroupFamily = RackDetailRendererFactory._propertyGroupNameToCssClassMap[propertyGroupName];
                }

                return 'property-group-{0}'.format(propertyGroupFamily);
            };
        }

        public static isHorizontalTile(tile: ITileInfo): boolean {
            var fRet: boolean;

            switch (tile.AssocDirection) {
                case 'Right':
                case 'Left':
                    fRet = true;
                    break;
                case 'Up':
                case 'Down':
                    fRet = false;
                    break;
                default:
                    // TODO: Unexpected. Need to check how to handle this.
                    // For now, treat this as a horizontal tile.
                    fRet = true;
            }
            return fRet;
        }

        public static groupConnectedTiles(group: ITileGroupByRow)
            : Array<IRackSubgroup> {
            var subgroups = [];
            if (group.tilesInHorizontalRows) {
                subgroups = subgroups.concat(RackDetailRendererFactory._groupConnectedTileInHorizontalRow(group.tilesInHorizontalRows));
            }
            if (group.tilesInVerticalRows) {
                subgroups = subgroups.concat(RackDetailRendererFactory._groupConnectedTileInVerticalRow(group.tilesInVerticalRows));
            }

            return subgroups;
        }


        private _getPropertyGroupsAsync(tiles: Array<ITileInfo>)
            : angular.IPromise<Array<IPropertySubgroup>> {
            /// <summary>Gets property groups with a given tiles collection.</summary>
            /// <returns type="Promise">A promise object</returns>

            var deferred = this.$q.defer();

            // Declare a property groups map which is keyed by property group names.
            // In each entry of the map, we keep tracking the group tiles in two collections.
            // One is for tiles showing in vertical rows. The other is for ones in horizontal rows.
            var propertyGroups = {};
            tiles.forEach((tile) => {
                if (!tile.PermittedBrand
                    || tile.Status !== 'Used'
                    || (tile.Class !== 'Server' && tile.Class !== 'Network')
                ) {
                    return;
                }

                // Divide tiles based on valid PermittedBrand property.
                // Which is equivalent to a property group.
                var propertyGroup = propertyGroups[tile.PermittedBrand];

                if (!propertyGroup) {
                    // Ensure an entry for this property group in our propertyGroups map.
                    propertyGroups[tile.PermittedBrand] = {};
                    propertyGroup = propertyGroups[tile.PermittedBrand];
                }

                if (RackDetailRendererFactory.isHorizontalTile(tile)) {
                    // When a tile's association direction is horizontal,
                    // we know the tile is in a vertical row.
                    if (!propertyGroup.tilesInVerticalRows) {
                        propertyGroup.tilesInVerticalRows = [];
                    }
                    propertyGroup.tilesInVerticalRows.push(tile);
                } else {
                    // When a tile's association direction is vertical,
                    // we know the tile is in a horizontal row.
                    if (!propertyGroup.tilesInHorizontalRows) {
                        propertyGroup.tilesInHorizontalRows = [];
                    }
                    propertyGroup.tilesInHorizontalRows.push(tile);
                }
            });

            // Now we re-group the connected tiles (adjacent tiles) per property groups.
            var groups = [];
            for (var prop in propertyGroups) {
                if (propertyGroups.hasOwnProperty(prop)) {
                    var subgroups = RackDetailRendererFactory.groupConnectedTiles(propertyGroups[prop]);
                    if (subgroups.length !== 0) {
                        groups.push({
                            name: prop,
                            subgroups: subgroups
                        });
                    }
                }
            }

            deferred.resolve(groups);

            return deferred.promise;
        }

        private static _groupConnectedTileInHorizontalRow(tiles: Array<ITileLocationPri>)
            : Array<IRackSubgroup> {
            /// <summary>Groups the connected tiles horizontally</summary>
            /// <param name="tiles" type="Array">a collection of tiles</param>
            /// <returns type="Array">
            ///     A collection of subgroups. Each group represents a set of connected tile.
            ///     We use startTile and endTile to tag the range.
            /// </returns>

            var subgroups = [];
            var currentX, currentY, currentSubgroup, currentTile;
            tiles.sort((tile1, tile2): number => {
                // Sort by y coordinates first then by x coordinates
                var ret = parseInt(tile1.Y) - parseInt(tile2.Y);

                if (ret === 0) {
                    ret = tile1.X.toLocaleLowerCase().localeCompare(tile2.X.toLocaleLowerCase());
                }

                return ret;
            }).forEach((tile) => {
                // Now all tiles should be sorted by Y then by X. 
                // We group tiles into connected subgroups.
                // What we mean by a connected tiles subgroup is -
                //  1. All connected tiles has the same Y coordinates
                //  2. Those tiles need to be continous in X direction.
                // So we scan all the sorted tiles and keep tracking their
                // x and y coordinates accordingly.

                // Check whether tile's x coordinate changes
                if (!currentTile || currentTile.Y !== tile.Y) {
                    // Y has changed. So close the current tracking subgroup when there is one.
                    if (currentSubgroup) {
                        currentSubgroup.endTile = currentTile;
                        subgroups.push(currentSubgroup);
                    }

                    // Start a new subgroup
                    currentSubgroup = {
                        startTile: tile,
                    }
                    currentTile = tile;
                } else {
                    // Y hasn't changed. Now check whether the new tile is connected to the previous tracking tile
                    if (SpaceRendererFactory.alphabetToNumber('AA', currentTile.Y) + 1
                        === SpaceRendererFactory.alphabetToNumber('AA', tile.Y)) {
                        // They are connected
                        currentTile = tile;
                    } else {
                        // They aren't connected. Close the current tracking subgroup when there is one.
                        if (currentSubgroup) {
                            currentSubgroup.endTile = currentTile;
                            subgroups.push(currentSubgroup);
                        }

                        // Start a new subgroup
                        currentSubgroup = {
                            startTile: tile,
                        }
                        currentTile = tile;
                    }
                }
            });

            // Close any open tracking subgroup.
            if (currentSubgroup && !currentSubgroup.endTile) {
                currentSubgroup.endTile = currentTile;
                subgroups.push(currentSubgroup);
            }

            return subgroups;

        }

        private static _groupConnectedTileInVerticalRow(tiles: Array<ITileLocationPri>)
            : Array<IRackSubgroup> {
            /// <summary>Groups the connected tiles vertically</summary>
            /// <param name="tiles" type="Array">a collection of tiles</param>
            /// <returns type="Array">
            ///     A collection of subgroups. Each group represents a set of connected tile.
            ///     We use startTile and endTile to tag the range.
            /// </returns>

            var subgroups = [];
            var currentX, currentY, currentSubgroup, currentTile;
            tiles.sort((tile1, tile2): number => {

                // Sort by x coordinates first then by y coordinates
                var ret = tile1.X.toLocaleLowerCase().localeCompare(tile2.X.toLocaleLowerCase());

                if (ret === 0) {
                    ret = parseInt(tile1.Y) - parseInt(tile2.Y);
                }

                return ret;
            }).forEach((tile) => {
                // Now all tiles should be sorted by X then by Y. 
                // We group tiles into connected subgroups.
                // What we mean by a connected tiles subgroup is -
                //  1. All connected tiles has the same X coordinates
                //  2. Those tiles need to be continous in Y direction.
                // So we scan all the sorted tiles and keep tracking their
                // x and y coordinates accordingly.

                // Check whether tile's x coordinate changes
                if (!currentTile || currentTile.X !== tile.X) {
                    // X has changed. So close the current tracking subgroup when there is one.
                    if (currentSubgroup) {
                        currentSubgroup.endTile = currentTile;
                        subgroups.push(currentSubgroup);
                    }

                    // Start a new subgroup
                    currentSubgroup = {
                        startTile: tile,
                    }
                    currentTile = tile;
                } else {
                    // X hasn't changed. Now check whether the new tile is connected to the previous tracking tile
                    if (parseInt(currentTile.Y) + 1 === parseInt(tile.Y)) {
                        // They are connected
                        currentTile = tile;
                    } else {
                        // They aren't connected. Close the current tracking subgroup when there is one.
                        if (currentSubgroup) {
                            currentSubgroup.endTile = currentTile;
                            subgroups.push(currentSubgroup);
                        }

                        // Start a new subgroup
                        currentSubgroup = {
                            startTile: tile,
                        }
                        currentTile = tile;
                    }
                }
            });

            // Close any open tracking subgroup.
            if (currentSubgroup && !currentSubgroup.endTile) {
                currentSubgroup.endTile = currentTile;
                subgroups.push(currentSubgroup);
            }

            return subgroups;
        }

    }

    interface ITileLocationPri {
        X: string;
        Y: string;
    }

};