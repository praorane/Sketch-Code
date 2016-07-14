//  Copyright (c) Microsoft Corporation. All rights reserved
//  power-list.controller.ts
//  Controller for the powerdevices list. 

/// <reference path="../../scripts/typings/angularjs/angular.d.ts" />

namespace SketchSvg {
    'use strict';

    export class PowerListController {
        public isPowerDetailsVisible: boolean = false;
        public selectedPowerSupply: IUPSDetailForSelectedColo;
        public powerLevels: IPowerLevel[];
        public selectedPowerLevel: IPowerLevel;

        public powerSupplyList: Array<IUPSDetailForSelectedColo> = [
            { "powerLevel": EPowerLevel[EPowerLevel.CRITICAL], "name": "01B", "totalPowerUsed": 710, "prelim": 210, "final": 230, "deployed": 270, "max": 705.5, "maxCritical": 708, "available": -4.5, "lId": "Critical", "zones": 3 },
            { "powerLevel": EPowerLevel[EPowerLevel.NORMAL], "name": "01A", "totalPowerUsed": 624, "prelim": 210, "final": 230, "deployed": 270, "max": 705.5, "maxCritical": 708, "available": -81.5, "lId": "Normal", "zones": 4 },
            { "powerLevel": EPowerLevel[EPowerLevel.NEARCRIT], "name": "02B", "totalPowerUsed": 710, "prelim": 210, "final": 230, "deployed": 270, "max": 705.5, "maxCritical": 708, "available": -81.5, "lId": "NearCritical", "zones": 3 },
            { "powerLevel": EPowerLevel[EPowerLevel.NORMAL], "name": "02A", "totalPowerUsed": 684, "prelim": 210, "final": 230, "deployed": 270, "max": 705.5, "maxCritical": 708, "available": 21.5, "lId": "Normal", "zones": 5 },
            { "powerLevel": EPowerLevel[EPowerLevel.NORMAL], "name": "03B", "totalPowerUsed": 624, "prelim": 210, "final": 230, "deployed": 270, "max": 705.5, "maxCritical": 708, "available": -4.5, "lId": "Normal", "zones": 3 },
            { "powerLevel": EPowerLevel[EPowerLevel.NORMAL], "name": "03A", "totalPowerUsed": 624, "prelim": 210, "final": 230, "deployed": 270, "max": 705.5, "maxCritical": 708, "available": 81.5, "lId": "Normal", "zones": 3 }
        ];

        public powerSummary: Array<IPowerSummary> = [
            { "description": "MAX UPS LOAD", "value": "707 KW" },
            { "description": "KW PER BUS", "value": "141.5 KW" },
            { "description": "MAX CRITICAL", "value": "4400 KW" },
            { "description": "COLO MAX", "value": "2702 KW" },
            { "description": "AIRFLOW USED", "value": "32706 CFM" },
            { "description": "AIRFLOW AVAILABLE", "value": "40000 CFM" }
        ];

        constructor() {
            var vm = this;
            vm.selectedPowerLevel = null;
            vm.powerLevels = [
                { "id": undefined, "name": "All UPS in Colo" },
                { "id": "Critical", "name": "Critical" },
                { "id": "NearCritical", "name": "Near Critical" },
                { "id": "Normal", "name": "Normal" }
            ];
            vm.selectedPowerLevel = vm.powerLevels[0];

        }

        public showPowerDetails(powerSupply: IUPSDetailForSelectedColo) {
            this.isPowerDetailsVisible = !this.isPowerDetailsVisible;
            this.selectedPowerSupply = powerSupply;
        }

        public powerLevelFilter = (powerSupply: IUPSDetailForSelectedColo): boolean => {
            return powerSupply.lId === this.selectedPowerLevel.id || angular.isUndefined(this.selectedPowerLevel.id);
        }

    }

    enum EPowerLevel {
        CRITICAL,
        NEARCRIT,
        NORMAL
    };

    interface IUPSDetailForSelectedColo {
        powerLevel: string;
        name: string;
        totalPowerUsed: number;
        prelim: number;
        final: number;
        deployed: number;
        max: number;
        maxCritical: number;
        available: number;
        lId: string;
        zones: number;

    }

    interface IPowerSummary {
        description: string;
        value: string;        
    }

    interface IPowerLevel {
        id: string;
        name: string;
    }   


}