/// <reference path="../../scripts/typings/es6-promise/es6-promise.d.ts" />
/// <reference path="app.model.ts" />
// Copyright (c) Microsoft Corporation. All rights reserved
//  datafetcher-factories.ts
//  The implementation of the data model of the map control

/// <reference path="../../Scripts/typings/angularjs/angular.d.ts" />
/// <reference path="../defs/common-types.d.ts" />
/// <reference path="../defs/service-objects.ts" />

namespace SketchSvg {
    'use strict';

    export enum DataLoadingState {
        None = 0,
        DataCenterCatalog = 0x01,
        GroupRequest = 0x01 << 1,
        DemandDetail = 0x01 << 2,
        TileStatus = 0x01 << 3,
        Power = 0x01 << 4,
        IncientReasons = 0x01 << 5
    }

    /**
      * @name DataLoadingProgress
      * @desc The object tracks data loading state. 
      *       Whenever an async loading operation starts, it
      *       should call start method of this helper. When 
      *       the operation ends, it should call end method.
      *       And controllers can retrieve the current states at any time 
      *       then update UIs coordinately.
    */
    export class DataLoadingProgress {
        public get state(): number {
            var retVal = DataLoadingState.None;
            for (var state in this._loadingStateTracker) {
                if (this._loadingStateTracker[state] !== 0) {
                    retVal |= parseInt(state);
                }
            }

            return retVal;
        }

        private _loadingStateTracker: {
            [loadingState: number]: number
        } = {};

        constructor() {
        }

        public start(state: number) {
            if (angular.isUndefined(this._loadingStateTracker[state])) {
                this._loadingStateTracker[state] = 0;
            }
            this._loadingStateTracker[state]++;
        }

        public end(state: number) {
            if (this._loadingStateTracker[state] > 0) {
                this._loadingStateTracker[state]--;
            }
        }
    }
};
