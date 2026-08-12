/**
 * @NApiVersion 2.1
 * @NScriptType Restlet
 */
define(["N/search"], (search) => {
  function get() {
    const workOrderSearch = search.create({
      type: "workorder",
      settings: [{ name: "consolidationtype", value: "ACCTTYPE" }],
      filters: [["mainline", "is", "T"], "AND", ["type", "anyof", "WorkOrd"]],
      columns: [
        search.createColumn({ name: "internalid" }),
        search.createColumn({ name: "trandate" }),
        search.createColumn({ name: "type" }),
        search.createColumn({ name: "tranid" }),
        search.createColumn({ name: "transactionnumber" }),
        search.createColumn({ name: "entity" }),
        search.createColumn({ name: "assembly" }),
        search.createColumn({ name: "startdate" }),
        search.createColumn({ name: "billofmaterials", join: "bomRevision" }),
        search.createColumn({ name: "quantity" }),
        search.createColumn({ name: "buildable" }),
        search.createColumn({ name: "built" }),
        search.createColumn({ name: "buildvariance" }),
        search.createColumn({ name: "statusref" }),
        search.createColumn({ name: "trackingnumbers" }),
        search.createColumn({ name: "memo" }),
        search.createColumn({ name: "currency" }),
        search.createColumn({ name: "fxamount" }),
        search.createColumn({ name: "amount" }),
        search.createColumn({ name: "docunit" }),
        search.createColumn({ name: "posting" }),
      ],
    });

    const workOrders = [];
    const pagedData = workOrderSearch.runPaged({ pageSize: 1000 });

    pagedData.pageRanges.forEach((pageRange) => {
      const page = pagedData.fetch({ index: pageRange.index });
      page.data.forEach((result) => {
        workOrders.push(mapResult(result));
      });
    });

    return {
      count: workOrders.length,
      workOrders,
    };
  }

  function mapResult(result) {
    return {
      id: result.getValue({ name: "internalid" }),
      trandate: result.getValue({ name: "trandate" }),
      type: result.getText({ name: "type" }) || result.getValue({ name: "type" }),
      tranid: result.getValue({ name: "tranid" }),
      transactionNumber: result.getValue({ name: "transactionnumber" }),
      entity: result.getValue({ name: "entity" }),
      entityText: result.getText({ name: "entity" }),
      assembly: result.getValue({ name: "assembly" }),
      assemblyText: result.getText({ name: "assembly" }),
      startdate: result.getValue({ name: "startdate" }),
      billOfMaterials: result.getValue({
        name: "billofmaterials",
        join: "bomRevision",
      }),
      billOfMaterialsText: result.getText({
        name: "billofmaterials",
        join: "bomRevision",
      }),
      quantity: result.getValue({ name: "quantity" }),
      buildable: result.getValue({ name: "buildable" }),
      built: result.getValue({ name: "built" }),
      buildVariance: result.getValue({ name: "buildvariance" }),
      status: result.getValue({ name: "statusref" }),
      status_text: result.getText({ name: "statusref" }),
      trackingNumbers: result.getValue({ name: "trackingnumbers" }),
      memo: result.getValue({ name: "memo" }),
      currency: result.getText({ name: "currency" }),
      fxAmount: result.getValue({ name: "fxamount" }),
      amount: result.getValue({ name: "amount" }),
      docUnit: result.getValue({ name: "docunit" }),
      posting: result.getValue({ name: "posting" }),
    };
  }

  return { get };
});
