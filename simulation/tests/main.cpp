#include <gtest/gtest.h>
#include <iostream>

using namespace std;

int main(int argc, char** argv)
{
	::testing::InitGoogleTest(&argc, argv);
	
	RUN_ALL_TESTS();
	while (getchar() != 'q')
		RUN_ALL_TESTS();
}