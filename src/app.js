import  { Auth0Client } from "@auth0/auth0-spa-js";

import PedigreeEditor from './script/pedigree';
import "babel-polyfill";

import '@fortawesome/fontawesome-free/js/fontawesome'
import '@fortawesome/fontawesome-free/js/solid'

import '../public/vendor/xwiki/xwiki-min.css';
import '../public/vendor/xwiki/fullScreen.css';
import '../public/vendor/xwiki/colibri.css';
import '../public/vendor/phenotips/Widgets.css';
import '../public/vendor/phenotips/DateTimePicker.css';
import '../public/vendor/phenotips/Skin.css';

import HPOTerm from 'pedigree/hpoTerm';

document.observe('dom:loaded', async function () {
  let auth0 = null;
  const configureAuth0 = async () => {
    auth0 = await new Auth0Client({
      domain: "gen-o-test.eu.auth0.com",
      client_id: "Kx350GeJFnWb1mYc5H3GjMvG8hrc2OYR",
      audience: "https://gen-o-test.eu.auth0.com/api/v2/",
    });
  };

  await configureAuth0();

  const authenticated = await auth0.isAuthenticated();
  const login = async () => {
    await auth0.loginWithRedirect({
      redirect_uri: window.location.href
    });
  };
  
  if (!authenticated) {
    const query = new URLSearchParams(window.location.search);
    if (query.has('code') && query.has('state')) {
      await auth0.handleRedirectCallback();
    } else {
      login();
    }
  }

  const graphql = async (body) => {
    const token = await auth0.getTokenSilently();

    const result = await fetch("https://test-graphql.northwestglh.com/v1/graphql", {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(body)
    }).then(r => r.json());

    return result;
  };
    
  const urlParams = new URLSearchParams(window.location.search);
  
  const editor = new PedigreeEditor({
    returnUrl: 'javascript:history.go(-2)',
    autosave: true,
    backend: {
      load: async ({ onSuccess, onError }) => {
        if (urlParams.has('phenopacket_id')) {
          const query = `
            query GetOpenPedigreeData($phenopacketId: uuid!) {
              pedigree:open_pedigree_data(where: {phenopacket_id: {_eq: $phenopacketId}}) {
                id
                rawData: pedigree_data
              }
            }
          `;
          const variables = {
            phenopacketId: urlParams.get('phenopacket_id')
          };
          const result = await graphql({
            query,
            variables
          });

          return onSuccess(
            JSON.stringify(
              result?.data?.pedigree[0]?.rawData?.jsonData ?? null
            )
          );
        } else {
          console.warn('No phenopacket ID has been specified. No data will be saved.')
        }
      },
      save: async ({ jsonData, svgData, setSaveInProgress }) => {
        //setSaveInProgress(true);
        const query = `
          mutation UpdateOpenPedigreeData(
            $phenopacketId: uuid!,
            $rawData: jsonb!
          ) {
            insert_family_one(
              object: {
                phenopacket_id: $phenopacketId,
                raw_open_pedigree_data: $rawData
              },
              on_conflict: {
                constraint: family_phenopacket_id_key,
                update_columns: raw_open_pedigree_data
              }
            ) {
              id
            }
          }
        `;
        const variables = {
          phenopacketId: urlParams.get('phenopacket_id'),
          rawData: {
            svgData,
            jsonData,
          },
        };
        const result = await graphql({query, variables});
        //setSaveInProgress(false);
      },
    } 
  });

  // hook externalid up to the gen-o database
  document.observe('pedigree:person:set:externalid', async (event) => {
    const query = `
      query GetDemographics(
        $primaryIdentifier: String!
      ) {
        individual(
          where: {
            primary_identifier: {_eq: $primaryIdentifier}
          }
      ) {
          date_of_birth
          date_of_death
          deceased
          first_name
          last_name
          primary_identifier
          sex
          phenopacket {
            phenotypic_features(where:{presence: {_eq: "PRESENT"}}) {
              hpo {
                id
                name
              }
            }
          }
        }
      }
    `;

    const variables = {
      primaryIdentifier: event.memo.value,
    };
    const result = await graphql({ query, variables });
    event.memo.node.setFirstName(
      result.data?.individual[0]?.first_name
    );
    event.memo.node.setLastName(
      result.data?.individual[0]?.last_name
    );
    event.memo.node.setLifeStatus(
      result.data?.individual[0]?.deceased
        ? 'deceased'
        : 'alive'
    );
    event.memo.node.setBirthDate(
      new Date(result.data?.individual[0]?.date_of_birth)
    );
    event.memo.node.setDeathDate(
      new Date(result.data?.individual[0]?.date_of_death)
    );
    var hpos = [];
    result.data?.individual[0]?.phenopacket?.phenotypic_features?.each(function(v) {
      hpos.push(new HPOTerm(v.hpo.id, v.hpo.name));
    });
    event.memo.node.setHPO(hpos);
    editor.getNodeMenu().update();
  });
});
