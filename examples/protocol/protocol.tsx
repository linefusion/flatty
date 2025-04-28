import { generator } from "@linefusion/flatty";

import { renderToString } from "react-dom/server";

function Test() {
  return <>{`function hello()`}</>;
}

export default generator(({ schema, error, log }) => {
  if (!schema) {
    error("No schema provided");
  }

  log.info(renderToString(<Test />)).line();

  log.info("Hello there!").line();

  return Promise.resolve();
});
