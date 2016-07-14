namespace SketchViewer
{
    using Microsoft.Cloud.InstrumentationFramework;
    using Microsoft.WindowsAzure;
    using SketchHelper.Utility.MdmLogging;
    using System;
    using System.Globalization;
    using System.Threading;
    using System.Web.Mvc;
    using System.Web.Optimization;
    using System.Web.Routing;

    public class MvcApplication : System.Web.HttpApplication
    {
        private static string MdmLoggingTagId = "FacilityPlanner";

        protected void Application_Start()
        {
            this.SetConfigVariables();
            AreaRegistration.RegisterAllAreas();
            FilterConfig.RegisterGlobalFilters(GlobalFilters.Filters);
            RouteConfig.RegisterRoutes(RouteTable.Routes);
            BundleConfig.RegisterBundles(BundleTable.Bundles);

            try
            {
                Tracer.SetTracer(new MdsTracer(new IfxLogger(CloudConfigurationManager.GetSetting("MDM.MonitoringAccount"),
                                                             CloudConfigurationManager.GetSetting("MDM.Namespace"),
                                                             MdmLoggingTagId)));
            }
            catch
            {
                // TODO :: where to log ?
            }

            this.logInitializationMessage();
        }

        private void SetConfigVariables()
        {
            this.Application["idaLoginUrl"] = string.Format(CultureInfo.InvariantCulture, CloudConfigurationManager.GetSetting("AADLoginUrl"));
            this.Application["idaTenant"] = string.Format(CultureInfo.InvariantCulture, CloudConfigurationManager.GetSetting("AADTenant"));
            this.Application["idaClientId"] = string.Format(CultureInfo.InvariantCulture, CloudConfigurationManager.GetSetting("FacilityPlannerAADClientId"));
            this.Application["urlSketchServer"] = string.Format(CultureInfo.InvariantCulture, CloudConfigurationManager.GetSetting("FacilityPlannerWebApiUrl"));

            // TODO: Uncomment the following links to retrieve the app key
            //string appKey = KeyVaultSecretAccessor.GetSecret(CloudConfigurationManager.GetSetting("KeyvaultAddress"),
            //    CloudConfigurationManager.GetSetting("KeyVaultAADAppKey"),
            //    CloudConfigurationManager.GetSetting("KeyvaultAuthClientId"),
            //    CloudConfigurationManager.GetSetting("KeyvaultAuthCertThumbprint"));
        }

        private void logInitializationMessage()
        {
            using (var operation = new Operation("FacilityPlannerInitialization"))
            {
                MdsTracer.InitializeIfxOperation(operation);
                // Just to Make Tracer to get initialized. Only once at initial application bootstrap .
                Thread.Sleep(100);

                Tracer.Log1DMetric(SingleDimentionMetric.ExceptionMetric, 1, "Facility planner initialized");
                Tracer.TraceInformation("Facility Planner initialized." + DateTime.Now.ToString());

                operation.SetResult(OperationResult.Success);
            }
        }
    }
}
