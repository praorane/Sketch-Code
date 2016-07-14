using System;
using System.Collections.Generic;
using Microsoft.Owin;
using Owin;
using Microsoft.Owin.Security.ActiveDirectory;
using System.Configuration;
using System.IdentityModel.Tokens;
using Microsoft.WindowsAzure;

[assembly: OwinStartup(typeof(SketchViewer.AuthConfig))] // TO bootstrap authentication 

namespace SketchViewer
{
    public class AuthConfig
    {
        public void Configuration(IAppBuilder app)
        {
            app.UseWindowsAzureActiveDirectoryBearerAuthentication(
                new WindowsAzureActiveDirectoryBearerAuthenticationOptions
                {
                    TokenValidationParameters = new TokenValidationParameters {
                        ValidAudience = CloudConfigurationManager.GetSetting("FacilityPlannerAADClientId")
                    },
                    Tenant = CloudConfigurationManager.GetSetting("AADTenant")
                });
        }
    }
}
