//  Copyright (c) Microsoft Corporation. All rights reserved
//  shared-blade-metro-data-center.controller.ts
//  Controller for the shared blade control. 

/// <reference path="../../scripts/typings/angularjs/angular.d.ts" />

namespace SketchSvg {
    'use strict';

    export class SharedBladeMetroDataCenterController {
        public dataCenterAndColos: IDataCenterAndColoRoom[] = new Array<IDataCenterAndColoRoom>();
        public selectedDataCenterAndColo: IDataCenterAndColoRoom = undefined;
        public selectedColoRoom: IColocation = undefined;
        public selectedDataCenterName: string | IDataCenterAndColoRoom = '';
        public selectedColoRoomName: string | IColocation = '';
        public isDataCenterValid: boolean;
        public isColoValid: boolean;

        public static $inject = ['$scope', '$rootScope', '$filter',
            'dataLoader', 'dataModelService', 'notificationService',
            'dataLoadingProgress'];

        private _handlerReleaser: HandlerReleaser;

        constructor(private $scope: angular.IScope,
            private $rootScope: angular.IRootScopeService,
            private $filter: angular.IFilterService,
            private _dataLoader: DataLoader,
            private _dataModelService: DataModelService,
            private _notificationService: NotificationService,
            private _dataLoadingProgress: DataLoadingProgress
        ) {

            var vm = this;

            this._handlerReleaser = new HandlerReleaser($scope);
            this._handlerReleaser.register(
                $scope.$watch('metroControl.selectedDataCenterName',
                    (newValue: string | IDataCenterAndColoRoom, oldValue: string | IDataCenterAndColoRoom) => {
                        if (newValue !== oldValue) {
                            vm.validateDataCenterInputs();
                        }
                    })
            );
            this._handlerReleaser.register(
                $scope.$watch('metroControl.selectedColoRoomName',
                    (newValue: string | IColocation, oldValue: string | IColocation) => {
                        if (newValue !== oldValue) {
                            vm.validateDataCenterInputs();
                        }
                    })
            );
        };

        public getDataCenterAndColos() {
            this._dataLoadingProgress.start(DataLoadingState.DataCenterCatalog);
            this._dataLoader.getDataCenterCatalogAsync()
                .then((data: IDataCenterResult): void => {
                    data.DataCenters.forEach((dataCenter: IDataCenterAndColoInfo) => {
                        var _dataCenter = <IDataCenter>{
                            id: dataCenter.Id,
                            name: dataCenter.Name
                        };
                        this.dataCenterAndColos.push({ 'DataCenter': _dataCenter, 'Colocations': dataCenter.Colocations });
                    });
                    this._dataLoadingProgress.end(DataLoadingState.DataCenterCatalog);
                })
                .catch((error: TypeError) => {
                    this._dataLoadingProgress.end(DataLoadingState.DataCenterCatalog);
                    this._notificationService.notify(new NotificationMessage(
                        'GetDataCenterCatalogAsync Error:',
                        AppStringResources.generalError.format(error.message),
                        ENotificationType.Error));
                });
        };

        public onSelectDataCenterAndColo() {
            if (this._dataModelService.currentDataCenterId !== this.selectedDataCenterAndColo.DataCenter.id) {
                this._dataModelService.currentDataCenterId = this.selectedDataCenterAndColo.DataCenter.id;
                if (angular.isDefined(this.selectedDataCenterAndColo)) {
                    this.notifySelectedDataCenterChange();
                }
            }
            if (angular.isDefined(this.selectedColoRoom)) {
                this._dataModelService.currentColoId = this.selectedColoRoom.Id;
                this.notifySelectedColoChange();
            }
        };

        public resetSelection() {
            this.selectedDataCenterAndColo = undefined;
            this.selectedColoRoom = undefined;
            this.selectedDataCenterName = '';
            this.selectedColoRoomName = '';
            this.isDataCenterValid = false;
            this.isColoValid = false;
            this.notifySelectedDataCenterChange();
            this.notifySelectedColoChange();
        };

        public validateDataCenterInputs() {
            var vm = this;
            var isColoValid = false;
            var isDataCenterValid = false;
            var enteredDataCenterName = (<IDataCenterAndColoRoom>vm.selectedDataCenterName).DataCenter
                ? (<IDataCenterAndColoRoom>vm.selectedDataCenterName).DataCenter.name
                : vm.selectedDataCenterName;
            var enteredColoRoomName = (<IColocation>vm.selectedColoRoomName).Name
                ? (<IColocation>vm.selectedColoRoomName).Name
                : vm.selectedColoRoomName;

            for (var i = 0; i < this.dataCenterAndColos.length; i++) {
                var dataCenterAndColo = this.dataCenterAndColos[i];
                if (dataCenterAndColo.DataCenter.name === enteredDataCenterName) {
                    isDataCenterValid = true;
                    this.selectedDataCenterAndColo = dataCenterAndColo;
                    for (var j = 0; j < dataCenterAndColo.Colocations.length; j++) {
                        var coloRoom = dataCenterAndColo.Colocations[j];
                        if (coloRoom.Name === enteredColoRoomName) {
                            this.selectedColoRoom = coloRoom;
                            this.selectedColoRoom.parentId = dataCenterAndColo.DataCenter.id;
                            this.selectedColoRoom.parentName = dataCenterAndColo.DataCenter.name;
                            this.selectedColoRoomName = coloRoom.Name;
                            isColoValid = true;
                        }
                    }
                }
            }

            this.isDataCenterValid = isDataCenterValid;
            this.isColoValid = isColoValid;
        }

        public notifySelectedColoChange() {
            this.$rootScope.$broadcast(AppCommand.selectColo, this.selectedColoRoom);
        }

        public notifySelectedDataCenterChange() {
            this.$rootScope.$broadcast(AppCommand.selectDataCenter, this.selectedDataCenterAndColo ? this.selectedDataCenterAndColo.DataCenter : undefined);
        }
    }

    interface IDataCenterAndColoRoom {
        DataCenter: IDataCenter;
        Colocations: IColocation[];
    }
}