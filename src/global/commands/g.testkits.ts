/* eslint-disable max-len */

const F = f(__filename);

export default testkits;

/**
 * Information about contacting the team!
 * @return {any} an object with information about the bot
 */
export async function testkits():Promise<HelpResource[]> {
  const response = [
    {
      name: 'Dosetest',
      country: 'Worldwide',
      website: 'https://dosetest.com/',
      description: '20% off test kits with code TripSit!',
    },
    {
      name: 'ReagentTests UK',
      country: 'UK & EU',
      website: 'https://www.reagent-tests.uk/shop/',
      description: '10% off with code tripsitwiki!',
    },
  ];
  log.info(F, `response: ${JSON.stringify(response, null, 2)}`);

  return response;
}

type HelpResource = {
  name: string;
  country: string;
  website: string;
  description: string;
};

const template = // eslint-disable-line
{
  name: '',
  country: '',
  website: '',
  description: '',
};
