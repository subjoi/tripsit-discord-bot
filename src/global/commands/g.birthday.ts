import { DateTime } from 'luxon';
import { db, getUser } from '../utils/knex';
import { Users } from '../@types/pgdb';

const F = f(__filename);

export default birthday;

/**
 * Birthday information of a user
 * @param {'get' | 'set'} command
 * @param {GuildMember} memberId
 * @param {string} month The birthday month
 * @param {number} day The birthday day
 * @return {string} an object with information about the bot
 */
export async function birthday(
  command: 'get' | 'set',
  memberId: string,
  month?: number | null,
  day?: number | null,
):Promise<DateTime | null> {
  let response = {} as DateTime | null;
  if (command === 'set') {
    // log.debug(F, `${command} ${memberId} ${month} ${day}`);
    const birthDate = DateTime.utc(2000, month as number, day as number);

    // log.debug(F, `Setting birthDate for ${memberId} to ${birthDate}`);

    await db<Users>('users')
      .insert({
        discord_id: memberId,
        birthday: birthDate.toJSDate(),
      })
      .onConflict('discord_id')
      .merge();
    response = birthDate;
  } else if (command === 'get') {
    const userData = await getUser(memberId, null);
    if (userData.birthday !== null) {
      const birthDateRaw = userData.birthday;
      // log.debug(F, `birthDate: ${birthDate}`);
      const birthDate = DateTime.fromJSDate(birthDateRaw, { zone: 'utc' });
      // log.debug(F, `birthday: ${birthday}`);
      response = birthDate;
    } else {
      // log.debug(F, `birthday is NULL`);
      response = null;
    }
  }
  log.info(F, `response: ${JSON.stringify(response, null, 2)}`);
  log.info(F, `response: ${JSON.stringify(response?.toJSDate().toString(), null, 2)}`);

  return response;
}
