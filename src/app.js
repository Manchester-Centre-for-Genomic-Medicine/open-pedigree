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
      // LIVE
      //domain: "gen-o.eu.auth0.com",
      //client_id: "cMDwFfxF4hC1GOs6W35HdDSPmregh6A7",
      //audience: "https://gen-o.eu.auth0.com/api/v2/",

      // TEST
      domain: "gen-o-test.eu.auth0.com",
      client_id: "Kx350GeJFnWb1mYc5H3GjMvG8hrc2OYR",
      audience: "https://gen-o-test.eu.auth0.com/api/v2/",

      // DEVELOP
      //domain: "gen-o-dev.eu.auth0.com",
      //client_id: "d3YJUQgU53bhu4O7nhPtFnXM4LjNUb6U",
      //audience: "https://gen-o-dev.eu.auth0.com/api/v2/",
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

  const getDemographicsGenO = async function (nhsID) {
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
      primaryIdentifier: nhsID,
    };
    const result = await graphql({ query, variables });
    return result;
  }

  const getDemographicsPDS = async function (nhsID) {
    const query = `
      query GetPatientDemographicsFromSpine($nhsNumber:String!) {
        individual:getPatientFromFHIR(id:$nhsNumber) {
          birthDate
          deceased
          deceasedDateTime
          name {
            given
            family
            period {
              start
            }
          }
          gender
        }
      }
    `;
    const variables = {
      nhsNumber: nhsID,
    };
    const result = await graphql({ query, variables });
    return result;
  }

  function clearNodeDemographics(node) {
    node.setFirstName('');
    node.setLastName('');
    node.setLifeStatus('alive');
    node.setBirthDate('');
    node.setDeathDate('');
    node.setGender('U');
    node.setHPO([]);
    node.setGenes([]);
    node.setDisorders([]);    
  }

  // hook externalid up to the gen-o database
  document.observe('pedigree:person:set:externalid', async (event) => {
    var result = await getDemographicsGenO(event.memo.value);
    if (result.data?.individual[0]) {
      clearNodeDemographics(event.memo.node);
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
      event.memo.node.setGender(
        result.data?.individual[0]?.sex
      );
      var hpos = [];
      result.data?.individual[0]?.phenopacket?.phenotypic_features?.each(function(v) {
        hpos.push(new HPOTerm(v.hpo.id, v.hpo.name));
      });
      event.memo.node.setHPO(hpos);
    } else {
      var result = await getDemographicsPDS(event.memo.value);
      if (result.data?.individual) {
        clearNodeDemographics(event.memo.node);
        var names = result.data.individual.name.sort(function(a, b) {
          return new Date(b.period.start) - new Date(a.period.start);
        });
        event.memo.node.setFirstName(names[0]?.given[0]);
        event.memo.node.setLastName(names[0]?.family);
        event.memo.node.setLifeStatus(
          result.data.individual?.deceased
            ? 'deceased'
            : 'alive'
        );
        event.memo.node.setBirthDate(
          new Date(result.data.individual?.birthDate)
        );
        event.memo.node.setDeathDate(
          new Date(result.data.individual?.deceasedDateTime)
        );
        event.memo.node.setGender(result.data.individual.gender);
      }
    }
    editor.getNodeMenu().update();
  });

  const getPhenopacketID = async function (nhsID) {
    const query = `
      query GetDemographics(
        $primaryIdentifier: String!
      ) {
        individual(
          where: {
            primary_identifier: {_eq: $primaryIdentifier}
          }
      ) {
          phenopacket_id
        }
      }
    `;
    const variables = {
      primaryIdentifier: nhsID,
    };
    const result = await graphql({ query, variables });
    return result.data?.individual[0]?.phenopacket_id;
  }

  const updateExternalHPO = async function (phenopacketId, hpoTerms, linkedHpoTerms, linkedHpoIds) {
    const query = `
      mutation UpdatePhenotypicFeaturesViaPedigree(
        $phenopacketId: uuid!,
        $hpoTerms: [hpo_insert_input!]! = {},
        $linkedHpoTerms: [phenotypic_feature_insert_input!]! = {},
        $linkedHpoIds: [String!]! = ""
      ) {
        insert_hpo(
          objects: $hpoTerms,
          on_conflict: {
            constraint: hpo_pkey,
            update_columns: []
          }
        ) {
          affected_rows
        }
        insert_phenotypic_feature(
          objects: $linkedHpoTerms,
          on_conflict: {
            constraint: phenotypic_feature_hpo_id_phenopacket_id_key,
            update_columns: []
          }
        ) {
          affected_rows
          returning {
            hpo {
              id
              name
            }
          }
        }
        delete_phenotypic_feature(
          where: {
            hpo_id: {_nin: $linkedHpoIds},
            _and: { phenopacket_id: {_eq: $phenopacketId} }
          }
        ) {
          affected_rows
        }
      }
    `;
    const variables = {
      phenopacketId: phenopacketId,
      hpoTerms: hpoTerms,
      linkedHpoTerms: linkedHpoTerms,
      linkedHpoIds: linkedHpoIds,
    };
    const result = await graphql({ query, variables });
    return result;
  }

  document.observe('pedigree:person:set:hpo', async (event) => {
    var phenopacketId = await getPhenopacketID(event.memo.node.getExternalID());
    var hpoTerms = [];
    var linkedHpoTerms = [];
    var linkedHpoIds = [];
    var hpos = event.memo.value;
    hpos.each( function (hpo) {
      var hpoID = HPOTerm.desanitizeID(hpo.getID());
      hpoTerms.push({ id: hpoID, name: hpo.getName() });
      linkedHpoTerms.push({ phenopacket_id: phenopacketId, hpo_id: hpoID, presence: "PRESENT" });
      linkedHpoIds.push(hpoID);
    });
    var result = await updateExternalHPO(phenopacketId, hpoTerms, linkedHpoTerms, linkedHpoIds);
  });
});

document.observe('pedigree:person:set:disorders', function(event) {
  // Note for future, for some reason it is executed twice on update...
  // Function to print Person external ID and disorder terms when the latter are updated.
  console.log('Person disorders were updated!')
  console.log('Person external ID:', event.memo.node.getExternalID())
  console.log('Disorders:')
  var disorders = event.memo.value
  for(var i = 0; i < disorders.length; i++) {
    var disorder = disorders[i]
    console.log(`${i}) ID: ${disorder.getDesanitizedDisorderID()}, Name: ${disorder.getName()}`);
  }
});

document.observe('pedigree:person:set:hpo', function(event) {
  // Function to print Person external ID and HPO terms when the latter are updated.
  console.log('Person HPO Terms were updated!');
  console.log('Person external ID:', event.memo.node.getExternalID());
  console.log('HPO Terms:');
  var hpos = event.memo.value;
  for(var i = 0; i < hpos.length; i++) {
    var hpo = hpos[i];
    console.log(`${i}) ID: ${HPOTerm.desanitizeID(hpo.getID())}, Name: ${hpo.getName()}`);
  }
});

document.observe('pedigree:person:set:genes', function(event) {
  // Function to print Person external ID and genes when the latter are updated.
  console.log('Person genes were updated!');
  console.log('Person external ID:', event.memo.node.getExternalID());
  console.log('Genes:');
  var genes = event.memo.value;
  for(var i = 0; i < genes.length; i++) {
    var gene = genes[i];
    console.log(`${i}) ID: ${gene.getID()}, Name: ${gene.getSymbol()}`);
  }
});
