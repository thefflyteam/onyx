import { Page } from "@playwright/test";

interface ConnectorResult {
  ccPairId: number;
  connectorId: number;
}

/**
 * Creates a simple file connector via backend API with mock credentials.
 * This enables the Knowledge toggle in assistant creation.
 *
 * @param page - Playwright page instance (must be authenticated)
 * @param connectorName - Name for the connector (defaults to "Test File Connector")
 * @returns Object containing ccPairId and connectorId
 */
export async function createFileConnector(
  page: Page,
  connectorName: string = "Test File Connector"
): Promise<ConnectorResult> {
  const response = await page.request.post(
    "http://localhost:3000/api/manage/admin/connector-with-mock-credential",
    {
      data: {
        name: connectorName,
        source: "file",
        input_type: "load_state",
        connector_specific_config: {
          file_locations: [],
        },
        refresh_freq: null,
        prune_freq: null,
        indexing_start: null,
        access_type: "public",
        groups: [],
      },
    }
  );

  if (!response.ok()) {
    const errorText = await response.text();
    throw new Error(
      `Failed to create connector: ${response.status()} - ${errorText}`
    );
  }

  const responseData = await response.json();
  const ccPairId = responseData.data;

  console.log(
    `[backendApiUtils] Created file connector: ${connectorName} (CC Pair ID: ${ccPairId})`
  );

  // Note: We don't have a direct way to get connector ID from this response,
  // but for cleanup purposes, we'll use the ccPairId
  return { ccPairId, connectorId: 0 };
}

/**
 * Creates a document set from connector-credential pairs.
 *
 * @param page - Playwright page instance (must be authenticated as admin)
 * @param documentSetName - Name for the document set
 * @param ccPairIds - Array of connector-credential pair IDs
 * @returns The document set ID
 */
export async function createDocumentSet(
  page: Page,
  documentSetName: string,
  ccPairIds: number[]
): Promise<number> {
  const response = await page.request.post(
    "http://localhost:3000/api/manage/admin/document-set",
    {
      data: {
        name: documentSetName,
        description: `Test document set: ${documentSetName}`,
        cc_pair_ids: ccPairIds,
        is_public: true,
        users: [],
        groups: [],
        federated_connectors: [],
      },
    }
  );

  if (!response.ok()) {
    const errorText = await response.text();
    throw new Error(
      `Failed to create document set: ${response.status()} - ${errorText}`
    );
  }

  const responseData = await response.json();
  console.log(
    `[backendApiUtils] Created document set: ${documentSetName} (ID: ${responseData.id})`
  );
  return responseData.id;
}

/**
 * Deletes a document set via backend API.
 *
 * @param page - Playwright page instance (must be authenticated as admin)
 * @param documentSetId - The document set ID to delete
 */
export async function deleteDocumentSet(
  page: Page,
  documentSetId: number
): Promise<void> {
  const response = await page.request.delete(
    `http://localhost:3000/api/manage/admin/document-set/${documentSetId}`
  );

  if (!response.ok()) {
    const errorText = await response.text();
    console.error(
      `[backendApiUtils] Failed to delete document set ${documentSetId}: ${response.status()} - ${errorText}`
    );
  } else {
    console.log(`[backendApiUtils] Deleted document set: ${documentSetId}`);
  }
}

/**
 * Deletes a connector-credential pair via backend API.
 *
 * @param page - Playwright page instance (must be authenticated as admin)
 * @param ccPairId - The connector-credential pair ID to delete
 */
export async function deleteCCPair(
  page: Page,
  ccPairId: number
): Promise<void> {
  // First, get the CC pair details to extract connector_id and credential_id
  const getResponse = await page.request.get(
    `http://localhost:3000/api/manage/admin/cc-pair/${ccPairId}`
  );

  if (!getResponse.ok()) {
    const errorText = await getResponse.text();
    console.error(
      `[backendApiUtils] Failed to get CC pair ${ccPairId} details: ${getResponse.status()} - ${errorText}`
    );
    return;
  }

  const ccPairInfo = await getResponse.json();
  const connectorId = ccPairInfo.connector.id;
  const credentialId = ccPairInfo.credential.id;

  // Now delete using the deletion-attempt endpoint
  const deleteResponse = await page.request.post(
    `http://localhost:3000/api/manage/admin/deletion-attempt`,
    {
      data: {
        connector_id: connectorId,
        credential_id: credentialId,
      },
    }
  );

  if (!deleteResponse.ok()) {
    const errorText = await deleteResponse.text();
    console.error(
      `[backendApiUtils] Failed to delete CC pair ${ccPairId}: ${deleteResponse.status()} - ${errorText}`
    );
  } else {
    console.log(
      `[backendApiUtils] Initiated deletion for CC pair: ${ccPairId} (connector: ${connectorId}, credential: ${credentialId})`
    );
  }
}
