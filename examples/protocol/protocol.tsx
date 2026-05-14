import { generator } from "@linefusion/flatty";

export default generator(({ schema }) => {
  console.log("\n");
  console.log("\n");
  console.log("\n");
  schema?.tables.forEach((table) => {
    console.log(`${table.name}`);
    table.fields.forEach((field) => {
      let t = `${field.type.data.kind}`;
      if (field.type.data.kind === "array") {
        t = t + "[]";
      } else if (field.type.data.kind === "struct") {
        t = "struct " + t;
      } else if (field.type.data.kind === "table") {
        t = "table " + field.type.data.name.toString();
      }
      console.log(`   ${t}\t${field.name}`);
    });
  });

  return Promise.resolve();
});
