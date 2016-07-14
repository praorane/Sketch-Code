// Copyright (c) Microsoft Corporation. All rights reserved
//  reservation-detail.service.ts
//  The implementation of reservation detail renderer service

/// <reference path="../../Scripts/typings/angularjs/angular.d.ts" />

module SketchSvg {
    'use strict';

    export interface IOrderRenderingData extends IReservationOrder {
        rects: Array<IRect>;
    }

    export interface IReservationDemandRenderingInfo {
        preliminaryDemands: Array<IOrderRenderingData>;
        finalDemands: Array<IOrderRenderingData>;
    }

    export class ReservationDetailRendererService {
        constructor(private dataModelService: DataModelService, private $log: angular.ILogService, private $q: angular.IQService) {
            /// <summary>Implements property group Rendering</summary>
            /// <param name="dataLoader" type="Object">dataLoader</param>
            /// <param name="$log" type="Object">$log</param>
            /// <param name="$q" type="Object">$q</param>
        }

        public getReservationGroupsAsync(
            dataCenterId: string,
            coloId: string,
            coloData: ColoData,
            coloXStart: string,
            coloYStart: number,
            xDelta: number,
            yDelta: number,
            headerHeight: number,
            footerHeight: number,
            xMargin: number,
            yMargin: number
        ): angular.IPromise<IReservationDemandRenderingInfo> {
            return this.dataModelService.getGroupReservationsAtDataCenterAsync(dataCenterId)
                .then((groupReservationData: GroupReservationDataAtDataCenter) => {
                    var orders: Array<IReservationOrderRacks> = groupReservationData.getOrderGroups(coloData);
                    var renderingGroups: {
                        preliminaryDemands: Array<IOrderRenderingData>;
                        finalDemands: Array<IOrderRenderingData>;
                    } = {
                        preliminaryDemands: [],
                        finalDemands: []
                    };

                    orders.forEach((order) => {
                        var boundingRects = SpaceRendererFactory.getBoundingRectsForGroups(
                            order.rackSubgroups,
                            coloXStart, coloYStart,
                            xDelta, yDelta,
                            headerHeight, footerHeight,
                            xMargin, yMargin);

                        var demand = {
                            demandId: order.demandId,
                            groupId: order.groupId,
                            coloId: order.coloId,
                            propertyGroupName: order.propertyGroupName,
                            orderId: order.orderId,
                            rects: []
                        };

                        boundingRects.forEach((boundingRect) => {
                            demand.rects.push({
                                x: boundingRect.x,
                                y: boundingRect.y,
                                width: boundingRect.width,
                                height: boundingRect.height
                            });
                        });

                        if (order.type === ReservationType[ReservationType.Preliminary]) {
                            renderingGroups.preliminaryDemands.push(demand);
                        } else {
                            renderingGroups.finalDemands.push(demand);
                        }
                    });

                    return renderingGroups;
                });
        }
    }
};