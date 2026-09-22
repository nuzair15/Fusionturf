/** PostgreSQL may abort one participant in a serializable race. Retry the entire transaction. */
export async function retrySerializable<T>(work: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await work(); }
    catch (error: any) { if (error?.code !== "P2034" || attempt >= 2) throw error; }
  }
}
