### Communication protocol

1. You can include location picker library by loading it in an iframe. 
You can specify lang query parameter in an iframe url to select particular language.

2. When location picker library is loaded and ready to receive locations it will send message in
following format: `{type: 'ready'}`

3. Upon receiving message from step 2 you have to provide locations to be rendered on map.
Message sent to library should be in this format `{type:'locations', payload:DropOff[]}`. 
**Note** DropOff is an json array of `Packlink\BusinessLogic\Http\DTO\DropOff`.

4. When location picker library receives locations, received locations will be rendered on google maps
thus allowing user to make selection.

5. When user selects location, location picker library will send message in the following format:
`{type:'select', payload: {id: SELECTED_LOCATION_ID}}`.

Reference implementation of specified communication protocol can be found at `/examples/index.html`