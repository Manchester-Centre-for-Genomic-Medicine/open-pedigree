export const GET_GENE = `
  query GetGene {
    gene(where: {source: {_eq: "HGNC"}}) {
      symbol
      hgnc_id
    }
  }
`;

export const GET_DISORDER_API = `
  query GetDisorderApi {
    disorder_api {
      ontology_id
      name
    }
  }
`;

export const GET_HPO_API = `
  query GetHpoApi {
    hpo {
      id
      name
    }
  }
`;

export const GET_FAMILY_DATA_FOR_OPEN_PEDIGREE = `
  mutation GetFamilyDataForOpenPedigree($phenopacket_id: uuid!) {
    family: insert_family_one(
      object: {
        phenopacket_id: $phenopacket_id
      },
      on_conflict: {
        constraint: family_phenopacket_id_key,
        update_columns: [phenopacket_id]
      }
    ) {
      id
      family_identifier
      cohort_id
      phenopacket {
        individual {
          id
        }
      }
    }
  }
`;

export const INSERT_COHORT = `
  mutation InsertCohort(
    $individual_id: uuid!,
    $clinical_family_record_identifier: String!
  ) {
    cohort: insert_cohort_one(
      object: {
        name: $clinical_family_record_identifier,
        type: "Family",
        share_status: "Internal",
        cohort_members: {
          data: {
            individual_id: $individual_id
          }
        }
      }
    ) {
      id
    }
  }
`;

export const UPDATE_FAMILY_COHORT = `
  mutation UpdateFamilyCohort(
    $family_id: uuid!,
    $cohort_id: uuid!
  ) {
    family: update_family_by_pk(
      pk_columns: {id: $family_id},
      _set: {
        cohort_id: $cohort_id
      }
    ) {
      id
      cohort_id
      family_identifier
      phenopacket {
        individual {
          id
        }
      }
    }
  }
`;

export const INSERT_COHORT_MEMBER_FROM_OPEN_PEDIGREE = `
  mutation InsertCohortMemberFromOpenPedigree(
    $cohort_id: uuid!,
    $individual_id: uuid!
  ) {
    cohort_member: insert_cohort_member_one(
      object: {
        cohort_id: $cohort_id,
        individual_id: $individual_id
      },
      on_conflict: {
        constraint: individual_appears_once_per_cohort,
        update_columns: []
      }
    ) {
      id
    }
  }
`;

export const REMOVE_COHORT_MEMBER_FROM_OPEN_PEDIGREE = `
  mutation RemoveCohortMemberFromOpenPedigree(
    $cohortId: uuid!,
    $phenopacketId: uuid!
  ) {
    cohort_member: delete_cohort_member(
      where: {
        _and: {
          cohort_id: {_eq: $cohortId},
          individual: {
            phenopacket_id: {_eq: $phenopacketId}
          }
        }
      }
    ) {
      affected_rows
      returning {
        cohort {
          cohort_members: cohort_members_aggregate {
            aggregate {
              count
            }
          }
        }
      }
    }
  }
`;

export const GET_OPEN_PEDIGREE_DATA = `
  query GetOpenPedigreeData($phenopacketId: uuid!) {
    pedigree:family(where: {phenopacket_id: {_eq: $phenopacketId}}) {
      id
      rawData: pedigree
    }
  }
`;

export const UPDATE_OPEN_PEDIGREE_DATA = `
  mutation UpdateOpenPedigreeData ($phenopacketId: uuid!, $rawData: jsonb!) {
    insert_family_one(object: {phenopacket_id:$phenopacketId,raw_open_pedigree_data:$rawData}, on_conflict: {constraint:family_phenopacket_id_key,update_columns:raw_open_pedigree_data}) {
      id
    }
  }
`;

export const GET_DEMOGRAPHICS = `
  query GetDemographics(
    $primaryIdentifier: String!
  ) {
    individual(
      where: {
        primary_identifier: {_eq: $primaryIdentifier}
      }
  ) {
      id
      date_of_birth
      date_of_death
      deceased
      first_name
      last_name
      primary_identifier
      sex
      phenopacket_id
      phenopacket {
        phenotypic_features(where:{presence: {_eq: "PRESENT"}}) {
          hpo {
            id
            name
          }
        }
        genomic_interpretations {
          display_text
          report_category
          pathogenicity_text
          pathogenicity_score
        }
      }
    }
  }
`;

export const GET_PATIENT_DEMOGRAPHICS_FROM_SPINE = `
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

export const INSERT_PHENOPACKET = `
  mutation InsertPhenopacket {
    phenopacket:insert_phenopacket_one(
      object: {}
    ) {
      id
    }
  }
`;

export const UPDATE_PHENOTYPIC_FEATURES_VIA_PEDIGREE = `
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

export const INSERT_INTERPRETATION = `
  mutation InsertInterpretation(
    $phenopacket_id: uuid!,
    $specialty_id: uuid!
  ) {
    interpretation:insert_interpretation_one(
      object:
        {
          phenopacket_id: $phenopacket_id,
          specialty_id: $specialty_id
        }
    ) {
        id
    }
  }
`;

export const GET_CASE_STATUS = `
  query GetCaseStatus($status: String! = "Referred") {
    case_status(where: {status: {_eq: $status}}) {
      id
    }
  }
`;

export const ADD_CASE_STATUS = `
  mutation AddCaseStatus(
    $phenopacket_id: uuid!,
    $case_status_id: uuid!,
    $notes: String
  ) {
    case_history:insert_case_history_one(
      object: {
        phenopacket_id: $phenopacket_id,
        case_status_id: $case_status_id,
        notes: $notes,
      }
    ) {
      id
    }
  }
`;

export const UPSERT_INDIVIDUAL = `
  mutation UpsertIndividual(
    $primary_identifier: String!,
    $phenopacket_id: uuid!,
    $first_name: String,
    $last_name: String,
    $deceased: Boolean,
    $date_of_birth: date,
    $date_of_death: date,
    $sex: sex
  ) {
    individual:insert_individual_one(
      object: {
        primary_identifier: $primary_identifier,
        phenopacket_id: $phenopacket_id,
        first_name: $first_name,
        last_name: $last_name,
        deceased: $deceased,
        date_of_birth: $date_of_birth,
        date_of_death: $date_of_death,
        sex: $sex
      },
      on_conflict: {
        constraint: individual_primary_identifier_key,
        update_columns: [
          first_name,
          last_name,
          deceased,
          date_of_birth,
          date_of_death,
          sex
        ]
      }
    ) {
        id
      }
    }
  `;
