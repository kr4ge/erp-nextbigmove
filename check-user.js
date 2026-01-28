const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkUser() {
  const user = await prisma.user.findFirst({
    where: { email: 'mika@test.com' },
    include: {
      userRoleAssignments: {
        include: {
          role: {
            include: {
              rolePermissions: {
                include: {
                  permission: true
                }
              }
            }
          }
        }
      },
      teamMemberships: true
    }
  });
  
  console.log('User Data:');
  console.log(JSON.stringify(user, null, 2));
  
  await prisma.$disconnect();
}

checkUser();
